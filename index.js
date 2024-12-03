const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

app.use(cors());

const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        console.error('Failed to open the database:', err.message);
    } else {
        db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                room TEXT,
                message TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
});
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        console.log(`${username} joined room: ${room}`);
        io.to(room).emit('message', {
            username: 'Admin',
            message: `${username} has joined the chat!`
        });
        db.all(`SELECT * FROM messages WHERE room = ? ORDER BY timestamp`, [room], (err, rows) => {
            if (err) {
                console.error('Database error:', err.message);
            } else {
                socket.emit('chatHistory', rows);
            }
        });
    });

    socket.on('chatMessage', ({ username, room, message }) => {
        const newMessage = { username, room, message };
        io.to(room).emit('message', newMessage);
        db.run(
            `INSERT INTO messages (username, room, message) VALUES (?, ?, ?)`,
            [username, room, message],
            (err) => {
                if (err) {
                    console.error('Error inserting message:', err.message);
                }
            }
        );
    });
    socket.on('typing', ({ username, room }) => {
        socket.to(room).emit('typing', `${username} is typing...`);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
