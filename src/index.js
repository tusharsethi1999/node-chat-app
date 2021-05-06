const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server) // socket io requires the server core object to be passed which isn't available to us because express manages it
// in the background 

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

// server (emit) -> client (receive) - countUpdated
// client (emit) -> server (receive) - increment

io.on('connection', (socket) => {
    console.log('New Web Socket Connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })
        // the ...spread operator automatically sends the values to the corresponding object keys.
        
        if (error) {
            return callback(error)
        }

        socket.join(user.room)
        // the above function is only available for the server

        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        // the difference between io.emit and socket.broadcast.emit is that io.emit send the message to all the connected clients, whereas 
        // socket.broadcast.emit sends it off to all the connected clients except the one connected to the present socket
        
        callback()
    })

    socket.on('sendMessage', (msg, callback) => {
        const user = getUser(socket.id)

        const filter = new Filter()

        if (filter.isProfane(msg)) {
            return callback('Profanity isn\'t allowed!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, msg))
        callback()
    })

    socket.on('sendLocation', ({ latitude, longitude } = {}, callback) => {
        const user = getUser(socket.id)

        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${latitude},${longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
 
    })
    // socket.emit('countUpdated', count)

    // socket.on('increment', () => {
    //     count++
    //     socket.emit('countUpdated', count)
    // socket.emit() sends the data to the connection which called it but io.emit() sends the data to all connections
    //     io.emit('countUpdated', count)
    // })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}`)
})