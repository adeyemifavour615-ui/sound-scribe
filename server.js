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

// 2. Define Song Schema and Model
const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  audioUrl: String,  // Link to external media/object storage
  coverUrl: String,
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
    const { title, artist, audioUrl, coverUrl } = req.body;

    // Core validation
    if (!title || !audioUrl) {
      return res.status(400).json({ error: "Title and Audio URL fields are mandatory." });
    }

    const newSong = new Song({
      title,
      artist: artist || "Unknown Artist",
      audioUrl,
      coverUrl: coverUrl || "https://via.placeholder.com/60"
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

    // Pipe stream directly down to client pipeline
    const webStream = response.body;
    const nodeStream = require('stream').Readable.fromWeb(webStream);
    nodeStream.pipe(res);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not complete download operation." });
  }
});

// 7. Database Seeding Route (Optional backup utility)
app.get('/api/seed', async (req, res) => {
  try {
    await Song.deleteMany({}); 
    const sampleSongs = [
      {
        title: "Creative Minds",
        artist: "Bensound",
        audioUrl: "https://www.bensound.com/bensound-music/bensound-creativeminds.mp3",
        coverUrl: "https://www.bensound.com/bensound-img/creativeminds.jpg"
      },
      {
        title: "Ukulele",
        artist: "Bensound",
        audioUrl: "https://www.bensound.com/bensound-music/bensound-ukulele.mp3",
        coverUrl: "https://www.bensound.com/bensound-img/ukulele.jpg"
      }
    ];
    await Song.insertMany(sampleSongs);
    res.json({ message: "Database seeded successfully with sample tracks!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Music server running smoothly on port ${PORT}`);
});