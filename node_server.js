const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const { sourceMapsEnabled } = require('process');
require('dotenv').config();
const app = express();
const server = http.createServer(app);
 

// CORS middleware
const allowedOrigins = [process.env.CORS_ORIGIN, 'http://127.0.0.1:8002', 'http://192.168.0.42:8000','http://192.168.43.205:8000'];

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', "*");
    // res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    next();
});

// Use body-parser for JSON data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.get('/', (req, res) => {
    res.send('ALL ABOUT THE LOVE...........')
})
// Socket.IO setup
const io = socketIO(server, {
    transports: ['polling', 'websocket'],
    cors: {
        origin: "*",
        methods: ['GET', 'POST']
    }
});

const user = new Map()

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    user.set(socket.id,socket.id)
    console.log("socket user id",user)
    // console.log('Client connected:', socket.handshake.auth.token);
    // console.log('Client connected:', socket.handshake.auth.user_id);
    let token       = null;
    let login_token = socket.handshake.auth.token;
    let userId      = socket.handshake.auth.user_id;
    console.log("Authent Token: ", login_token);
    console.log("Authent userId: ", userId);

    io.emit('auth_info', {"socket": socket.id, "user_id": userId, "login_token": login_token, "connection": true});

    socket.on('get_token', (receivedToken) => {
        console.log('Token received:', receivedToken);
        token = receivedToken;
    });
socket.on("getUser",()=>{
    const CurrentUser = user.get(socket.id) 
    console.log("user..",CurrentUser)
    socket.emit("getUser",CurrentUser)
})
    socket.on('toast', (data) => {
        console.log('Toast received:', data);

        if (token) {
            data['token'] = token;
            io.emit('toast', data);
        } else {
            console.log('Token not yet received');
        }
    });

    socket.on('is_replay_on_time', (data) => {
        console.log("data:---->", data);

        // Forward the replay status to the specific room
        io.emit('is_replay_on_time', data);
    });

    socket.on('note_delete', (data) => {
        io.emit('note_delete', data);
    });

    // Listen for 'message_status' event from Python backend
    socket.on('message_status', (data) => {
        const { room_id, data: statusData } = data;
        const { status, msg_id, contact_id } = statusData;
        console.log(`Message status received for room ${room_id}:`, statusData);

        // Emit the message status event to the clients in the specific room
        io.to(room_id).emit('message_status', statusData);
    });

    // Listen for 'user_status' event from Python backend
    socket.on('user_status', (data) => {
        console.log("user_status:---->", data);
        const { room_id, contact_id, status } = data;
        console.log(`User status received: ${contact_id} is ${status} in room ${room_id}`);

        // Emit the user status event to the clients in the specific room
        io.to(room_id).emit('user_status', { contact_id, status });
    });

    // Handle room joining
    socket.on('join_room', (room_id) => {
        console.log(`Client ${socket.id} joining room: ${room_id}`);
        socket.join(room_id);
    });

    // Handle room leaving
    socket.on('leave_room', (room_id) => {
        console.log(`Client ${socket.id} leaving room: ${room_id}`);
        socket.leave(room_id);
    });

    // Handle messages
    socket.on('message', (newdata) => {
        console.log('Get message:', (newdata));
        // socket.emit('message', data);
        // const { wp_msg_utc_timestamp, is_system_number, room_id, ...messageData } = data;
        const { room_id, ...data } = newdata;
        console.log("room_id", room_id)
        // io.emit('message', {"message_data":data});
        io.to(room_id).emit('message', {
            room_id: room_id,
            message_data: data,
            // wp_msg_utc_timestamp: wp_msg_utc_timestamp,
            // is_system_number: is_system_number
        });
    });

    socket.on('template', (data) => {
        console.log("Template data:=======>", data);
        io.emit('template', data);
    })

    socket.on('temp_update_msg', (msg) => {
        console.log("Template update msg:=======>", msg);
        io.emit('temp_update_msg', msg);
    })

    // Listen for 'read_by' event from the client
    socket.on('read_by', (data) => {
        console.log('Received read_by data:', data);
        // Option 1: Emit to all clients (broadcast)
        io.emit('read_by', data);
        
    });
    socket.on("editing",(data)=>{
         console.log("editiing data id",data);
         io.emit("editing",{data,socket:socket.id})
    })

    socket.on('msg_read_by', (data) => {
        console.log("msg_read_by:", data);
        io.emit("msg_read_by", data)
    });

    socket.on('newMessage', (data) => {
        console.log("New message:", data);
        io.emit("newMessage", data)
    });

    socket.on('campaign', (data) => {
        console.log("Campaign Status :", data);
        io.emit("campaign", data)
    });

    socket.on('chatbot_connect', (data) => {
        console.log("chatbot connect :", data);
        io.emit("chatbot_connect", data)
    });

    
    socket.on('leave_conversation', (data) => {
        console.log("leave_conversation :", data);
        io.emit("leave_conversation", data)
    });

    

    socket.on('chatbot_disconnect', (data) => {
        console.log("chatbot chatbot_disconnect :", data);
        io.emit("chatbot_disconnect", data)
    });
    socket.on('disconnect', () => {
        io.emit('auth_info', {"socket": socket.id, "user_id": "", "login_token": "", "connection": false});
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
server.listen(process.env.PORT, process.env.NODE_SERVER_IP, () => {
    console.log('listening  on PORT',process.env.PORT);
    console.log('IP',process.env.NODE_SERVER_IP);
});
















// const http = require('http');
// const express = require('express');
// const socketIO = require('socket.io');
// const cors = require('cors');

// const app = express();
// app.use(cors());

// // Create a server for HTTP requests and Socket.IO connections
// const server = http.createServer(app);
// const io = socketIO(server, {
//     cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//     }
// });

// // Handle Socket.IO client connections
// io.on('connection', (socket) => {
//     console.log('Socket.IO client connected:', socket.id);

//     // Forward messages from the Python client to other clients or handle as needed
//     socket.on('message', (msg) => {
//         console.log('Message from Python client:', msg);
//         socket.broadcast.emit('message', msg); // Broadcast message to other clients
//     });

//     // Handle disconnections
//     socket.on('disconnect', () => {
//         console.log('Socket.IO client disconnected:', socket.id);
//     });
// });

// app.get('/', (req, res) => {
//     res.send('Socket.IO server is running.');
// });

// // Start the Node.js server on a specific IP address and port
// server.listen(3001, '0.0.0.0', () => {
//     console.log('Node.js server listening on port 3001');
// });





// const http = require('http');
// const express = require('express');
// const socketIO = require('socket.io');
// const ioClient = require('socket.io-client');
// const cors = require('cors');

// const app = express();
// app.use(cors());

// // Create a server for HTTP requests and Socket.IO connections
// const server = http.createServer(app);
// const io = socketIO(server, {
//     cors: {
//         origin: "*",
//         methods: ["GET", "POST"]
//     }
// });

// // Connect to FastAPI Socket.IO server
// const fastAPISocket = ioClient('http://192.168.0.42:8000/socket.io', {
//     transports: ['websocket']
// });

// fastAPISocket.on('connect', () => {
//     console.log('Connected to FastAPI Socket.IO server');
// });

// fastAPISocket.on('disconnect', () => {
//     console.log('Disconnected from FastAPI Socket.IO server');
// });

// fastAPISocket.on('message', (msg) => {
//     console.log('Message from FastAPI:', msg);
// });

// // Handle Next.js client connections
// io.on('connect', (socket) => {
//     console.log('Next.js client connected:', socket.id);

//     // Forward messages to FastAPI
//     socket.on('message', (msg) => {
//         fastAPISocket.emit('message', msg);
//     });

//     // Handle disconnections
//     socket.on('disconnect', () => {
//         console.log('Next.js client disconnected:', socket.id);
//     });
// });

// app.get('/', (req, res) => {
//     res.send('Socket.IO server is running.');
// });

// // Start the Node.js server on a specific IP address
// server.listen(3001, '192.168.0.42', () => {
//     console.log('Node.js server listening on 192.168.0.42:3001');
// });









// const http = require('http');
// const express = require('express');
// const socketIO = require('socket.io');
// const ioClient = require('socket.io-client');
// const cors = require('cors');

// const app = express();
// app.use(cors());

// // Create a server for HTTP requests and Socket.IO connections
// const server = http.createServer(app);
// const io = socketIO(server);

// // Connect to FastAPI Socket.IO server
// const fastAPISocket = ioClient('http://192.168.0.42:8000'); // Replace with your FastAPI server URL

// fastAPISocket.on('connect', () => {
//     console.log('Connected to FastAPI Socket.IO server');
// });

// fastAPISocket.on('disconnect', () => {
//     console.log('Disconnected from FastAPI Socket.IO server');
// });

// fastAPISocket.on('message', (msg) => {
//     console.log('Message from FastAPI:', msg);
// });

// // Handle Next.js client connections
// io.on('connect', (socket) => {
//     console.log('Next.js client connected:', socket.id);

//     // Forward messages to FastAPI
//     socket.on('message', (msg) => {
//         fastAPISocket.emit('message', msg);
//     });

//     // Handle disconnections
//     socket.on('disconnect', () => {
//         console.log('Next.js client disconnected:', socket.id);
//     });
// });

// app.get('/', (req, res) => {
//     res.send('Socket.IO server is running.');
// });

// // Start the Node.js server on a specific IP address
// server.listen(3001, '192.168.0.42', () => {
//     console.log('Node.js server listening on 192.168.0.42:3001');
// });








// const http = require('http');
// const express = require('express');
// const socketIO = require('socket.io');
// const ioClient = require('socket.io-client');

// const app = express();
// const server = http.createServer(app);
// const io = socketIO(server);

// // Connect to the FastAPI Socket.IO server
// const fastAPISocket = ioClient('http://192.168.0.42:8000'); // Replace with your FastAPI server address

// // Handle connections from FastAPI
// fastAPISocket.on('connect', (sid) => {
//     console.log('Connected to FastAPI Socket.IO server', { sid });
// });

// fastAPISocket.on('disconnect', (sid) => {
//     console.log('Disconnected from FastAPI Socket.IO server', { sid });
// });

// // Handle connections from Next.js clients
// io.on('connect', (socket) => {
//     console.log('Next.js client connected');

//     socket.on('disconnect', () => {
//         console.log('Next.js client disconnected');
//     });
// });

// app.get('/', (req, res) => {
//     res.send('Socket.IO server is running.');
// });

// // Start the server
// server.listen(3001, () => {
//     console.log('Node.js server listening on port 3001');
// });
