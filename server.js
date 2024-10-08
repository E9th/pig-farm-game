const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path'); 
const app = express();

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// MongoDB URI (ใช้ environment variable หรือค่าที่ตั้งไว้เป็นค่าเริ่มต้น)
const uri = process.env.MONGO_URI || 'mongodb+srv://thanapondongphuyaw:ktCJebYokzUbKOaC@pig-farm-game.rlyss.mongodb.net/?retryWrites=true&w=majority';

// JWT Secret (ใช้ environment variable หรือค่าที่ตั้งไว้เป็นค่าเริ่มต้น)
const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123!';
const JWT_EXPIRATION = '1h';

// เชื่อมต่อ MongoDB
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("Connected to MongoDB Atlas successfully");
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
  });

// สร้าง Schema และ Model สำหรับ User
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pigs: { type: Array, default: [] },
    coins: { type: Number, default: 0 },
    guilds: { type: Array, default: [] },
    playerGuild: { type: String, default: null },
    marketplace: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// ฟังก์ชันสำหรับสร้างโทเค็น
function createToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

// API สำหรับการสมัครสมาชิก
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: 'Username already exists!' });
    }
});

// API สำหรับการเข้าสู่ระบบ
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user) {
        if (await bcrypt.compare(password, user.password)) {
            const token = createToken(user._id);
            console.log("Generated token:", token); // ตรวจสอบ token
            res.json({ success: true, token });
        } else {
            res.json({ success: false, message: 'Invalid username or password!' });
        }
    } else {
        res.json({ success: false, message: 'Invalid username or password!' });
    }
});

// API สำหรับการรีเฟรชโทเค็น
app.post('/api/refreshToken', (req, res) => {
    const { token } = req.body;
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
        const newToken = createToken(decoded.userId);
        res.json({ success: true, token: newToken });
    });
});

// API สำหรับบันทึกข้อมูลเกม
app.post('/api/saveGame', async (req, res) => {
    const { token, pigs, coins, guilds, playerGuild, marketplace } = req.body;
    
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (typeof pigs === 'undefined' || typeof coins === 'undefined') {
        return res.status(400).json({ success: false, message: 'Invalid game data' });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error('Invalid token:', err);
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        try {
            await User.updateOne({ _id: decoded.userId }, { pigs, coins, guilds, playerGuild, marketplace });
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving game data:', error);
            res.json({ success: false, message: 'Error saving game data.' });
        }
    });
});

// API สำหรับการดูอันดับ
app.get('/api/leaderboard', async (req, res) => {
    const leaderboard = await User.find().sort({ coins: -1 }).limit(10).select('username coins');
    res.json({ success: true, leaderboard });
});

// เสิร์ฟไฟล์ static จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// เสิร์ฟไฟล์ index.html เมื่อเข้าถึง root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// API สำหรับดึงข้อมูลเกม
app.post('/api/getGameData', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error('Invalid token:', err);
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }

        try {
            const user = await User.findById(decoded.userId);
            if (user) {
                res.json({ 
                    success: true,
                    pigs: user.pigs,
                    coins: user.coins,
                    guilds: user.guilds,
                    playerGuild: user.playerGuild,
                    marketplace: user.marketplace
                });
            } else {
                res.json({ success: false, message: 'User not found' });
            }
        } catch (error) {
            console.error('Error fetching game data:', error);
            res.json({ success: false, message: 'Error fetching game data.' });
        }
    });
});

// เพิ่ม Route สำหรับการจัดการต่างๆ ของเกม

// Route สำหรับการสร้างหมู (Pig)
app.post('/api/raisePig', (req, res) => {
    // Logic สำหรับการสร้าง Pig
    res.json({ success: true, newPig: { type: req.body.pigType, coinsPerSecond: 1, strength: 5 } });
});

// Route สำหรับการสร้าง Guild
app.post('/api/createGuild', (req, res) => {
    // Logic สำหรับการสร้าง Guild
    res.json({ success: true, guildName: req.body.guildName });
});

// Route สำหรับการเข้าร่วม Guild
app.post('/api/joinGuild', (req, res) => {
    // Logic สำหรับการเข้าร่วม Guild
    res.json({ success: true, guildName: req.body.guildName });
});

// Route สำหรับการมีส่วนร่วมใน Guild Quest
app.post('/api/contributeToGuildQuest', (req, res) => {
    // Logic สำหรับการมีส่วนร่วมใน Guild Quest
    res.json({ success: true });
});

// Route สำหรับการเปลี่ยนฤดูกาลในเกม
app.post('/api/changeSeason', (req, res) => {
    // Logic สำหรับการเปลี่ยนฤดูกาล
    res.json({ success: true, newSeason: "Winter" });
});

// Route สำหรับการขายไอเทมในตลาดกลาง
app.post('/api/sellItem', (req, res) => {
    // Logic สำหรับการขาย Item
    res.json({ success: true });
});
