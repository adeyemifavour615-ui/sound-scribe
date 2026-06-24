require('dotenv').config(); // Load environment variables from your .env file
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
// Use Render's dynamic port environment variable, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON payloads and serve static frontend files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Connect to MongoDB Atlas (Using the hidden environment variable)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas Cloud!'))
  .catch(err => console.error('MongoDB connection error:', err));

// 2. Define Song Schema and Model (With Added Genre Support)
const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  audioUrl: String,  // Link to external media/object storage
  coverUrl: String,
  genre: { type: String, default: "All" }, // Track specific music category
  downloadCount: { type: Number, default: 0 }
});

const Song = mongoose.model('Song', songSchema);

// 3. API: Get all available tracks from MongoDB
app.get('/api/songs', async (req, res) => {
  try {
    const songs = await Song.find();
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. API: Add a new song (Admin Feature Form Receiver)
app.post('/api/songs', async (req, res) => {
  try {
    const { title, artist, audioUrl, coverUrl, genre } = req.body;

    // Core validation
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
    res.status(201).json({ message: "Song added to database successfully!", song: newSong });
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

// 6. API: Increment download count and force file download stream
app.get('/api/songs/download/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ error: "Song track not found" });
    }

    // Update download metric in Atlas cloud
    song.downloadCount += 1;
    await song.save();

    // Pull file binary stream from the remote storage target
    const response = await fetch(song.audioUrl);
    if (!response.ok) throw new Error('Failed to retrieve file from storage server.');

    const fileName = `${song.artist} - ${song.title}.mp3`;
    
    // Force the user's browser to execute a file download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    // Bulletproof stream transfer from fetch web-stream down to client response pipeline
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