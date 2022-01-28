const express = require('express')
const app = express()
const server = require('http').Server(app)
const { v4: uuidv4 } = require("uuid");

app.set('view engine', 'ejs')
app.use(express.static('public'))
const session = require('express-session');
app.use(session({secret: 'mySecret', resave: false, saveUninitialized: false}));

var serverUrl = "https://speakingspace.online"

app.get('/', (req, res) => {
    res.render('lobby', {room: req.query.room, serverHttpUrl: serverUrl})
})
app.get('/create-room', (req, res) => {
    var userId = req.query.userId
    var roomId = req.query.roomId
    req.session.context = {"userId": userId, "action": "CREATE"};
    console.log('GOT create request for user ' + userId)
    res.redirect('/rooms/' + roomId)
})
app.get('/join-room/:room', (req, res) => {
    var userId = req.query.userId
    req.session.context = {"userId": userId, "action": "JOIN"};
    console.log('GOT join request for user ' + userId)
    res.redirect('/rooms/' + req.params.room)
})
app.get('/rooms/:room', (req, res) => {
    if (!req.session.context) {
        console.log("tuta")
        res.redirect('/')
        return
    }
    var userId = req.session.context.userId
    var roomId = req.params.room
    console.log("Redirecting user " + userId + " to room " + roomId)
    res.render('room', {room: roomId, userId: userId, action: req.session.context.action})
})
app.get('/greeting/:name', (req, res) => res.status(200).send("Hello " + req.params.name + "!"))

server.listen(3000)


