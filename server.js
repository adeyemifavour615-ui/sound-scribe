require('dotenv').config(); // Load environment variables from your .env file
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON payloads and serve static frontend files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas Cloud!'))
  .catch(err => console.error('MongoDB connection error:', err));

// 2. Define Song Schema and Model
const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  audioUrl: String,  
  coverUrl: String,
  genre: { type: String, default: "All" }, 
  downloadCount: { type: Number, default: 0 }
});

const Song = mongoose.model('Song', songSchema);

// 3. API: Get all available tracks
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await Song.find();
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. API: Add a new song (Admin Feature)
app.post('/api/songs', async (req, res) => {
  try {
    const { title, artist, audioUrl, coverUrl, genre } = req.body;

    if (!title || !audioUrl) {
      return res.status(400).json({ error: "Title and Audio URL fields are mandatory." });
    }

    const newSong = new Song({
      title,
      artist: artist || "Unknown Artist",
      audioUrl,
      coverUrl: coverUrl || "https://via.placeholder.com/60",
      genre: genre || "All"
    });

    await newSong.save();
    res.status(201).json({ message: "Song added successfully!", song: newSong });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. API: Delete a song by ID (Admin Feature)
app.delete('/api/songs/:id', async (req, res) => {
  try {
    const deletedSong = await Song.findByIdAndDelete(req.params.id);
    if (!deletedSong) {
      return res.status(404).json({ error: "Song not found in database." });
    }
    res.json({ message: "Song successfully deleted from the platform!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. API: Stream & Force standard client file download 
app.get('/api/songs/download/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: "Song track not found" });
    }

    song.downloadCount += 1;
    await song.save();

    const response = await fetch(song.audioUrl);
    if (!response.ok) throw new Error('Failed to retrieve file from storage server.');

    const fileName = `${song.artist} - ${song.title}.mp3`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    const nodeStream = require('stream').Readable.fromWeb(response.body);
    nodeStream.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not complete download operation." });
  }
});

app.listen(PORT, () => {
  console.log(`Music server running smoothly on port ${PORT}`);
});