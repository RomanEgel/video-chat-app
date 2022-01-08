const express = require('express')
const app = express()
const server = require('http').Server(app)
const { v4: uuidv4 } = require("uuid");

app.set('view engine', 'ejs')
app.use(express.static('public'))
const session = require('express-session');
app.use(session({secret: 'mySecret', resave: false, saveUninitialized: false}));

app.get('/', (req, res) => {
    res.render('lobby', {room: req.query.room})
})
app.get('/create-room', (req, res) => {
    var username = req.query.name
    req.session.context = {"username": username, "action": "CREATE"};
    console.log('GOT create request for user ' + username)
    res.redirect('/rooms/' + uuidv4())
})
app.get('/join-room/:room', (req, res) => {
    var username = req.query.name
    req.session.context = {"username": username, "action": "JOIN"};
    console.log('GOT join request for user ' + username)
    res.redirect('/rooms/' + req.params.room)
})
app.get('/rooms/:room', (req, res) => {
    if (!req.session.context) {
        console.log("tuta")
        res.redirect('/')
        return
    }
    var name = req.session.context.username
    var roomId = req.params.room
    console.log("Redirecting user " + name + " to room " + roomId)
    res.render('room', {room: roomId, username: name, action: req.session.context.action})
})
app.get('/greeting/:name', (req, res) => res.status(200).send("Hello " + req.params.name + "!"))

server.listen(3000)


