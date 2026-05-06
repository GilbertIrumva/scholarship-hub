const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');

app.use(cors());

const DB_PATH = path.join(__dirname, 'db.json');

const readDb = () => {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
};

const writeDb = (db) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
};

app.use(express.json());


app.get('/', (req, res) => res.send('Scholarship API is running!'));

app.get('/api/scholarships', (req, res) => {
    const db = readDb();
    res.json(db.scholarShip);
});

app.get('/api/scholarships/:id', (req, res) => {
    const db = readDb();
    const student = db.scholarShip.find(s => s.id === parseInt(req.params.id, 10));

    return student
        ? res.json(student)
        : res.status(404).json({ message: "Student not found" });
});

app.post('/api/scholarships', (req, res) => {
    const db = readDb();
    const nextId = db.scholarShip.length
        ? Math.max(...db.scholarShip.map(s => s.id)) + 1
        : 1;
    const newEntry = { id: nextId, ...req.body };
    db.scholarShip.push(newEntry);
    writeDb(db);

    res.status(201).json(newEntry);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));