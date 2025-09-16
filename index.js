const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const path   = require('path');
// const axios  = require('axios');
var mysql    = require('mysql');

const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');


const ejs = require('ejs');
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); 

const users = {};

const { Server } = require("socket.io");
// const io = new Server(server);

// databse connection
// var pool = mysql.createPool({
//   connectionLimit: 10,
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "chatbuddy"
// });

var pool = mysql.createPool({
  connectionLimit: 10,
  host: "localhost",
  user: "root",
  password: "pass2Strong@rajnish",
  database: "chat_buddy"
});


// pool.connect(function(err) {
//   if (err) throw err;
//   console.log("Connected!");
// });

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://64.227.168.246:8003'); // Allow requests from your Django application
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  next();
});

// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3000'); // Allow requests from your Django application
//   res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
//   next();
// });


// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', 'http://inchatdaphne.inlancer.in'); // Allow requests from your Django frontend application
//   res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
//   next();
// });




// const io = require('socket.io')(server, {
//   transports: ['polling', 'websocket'],
//   cors: {
//     origin: 'http://127.0.0.1:8000',
//     methods: ['GET', 'POST']
//   }
// });


// project ip
const io = require('socket.io')(server, {
  transports: ['polling', 'websocket'],
  cors: {
    origin: 'http://64.227.168.246:8003',
    methods: ['GET', 'POST']
  }
});


// app.get('/', (req, res) => {
//   // res.sendFile(__dirname + '/views/chat.html');
//   res.sendFile(path.join(__dirname, 'views', 'chat.html'));  

// });




app.get('/api/socket', (req, res) => {
   
  io.on('connection', (socket) => {
       
      socket.on('join', (username) => {
         
        users[socket.id] = username;
        console.log(`${username} connected`);

        socket.on('message', (message,sender,receiver,time) => {
          console.log('Message:', message,sender,receiver,time);
           
          io.emit('message', {
            username: users[socket.id],  
            message : message,
            sender  : sender,
            receiver: receiver,
            time    : time
    
          });
      });

         
      socket.on('disconnect', () => {
            console.log(`${username} disconnected`);
            
            io.emit('userLeft', `${username} has left the chat`);

            delete users[socket.id];
        });
    });
  });

});




io.on('connection', (socket) => {
  socket.on('join', (username) => {
    socket.join(username);
    users[socket.id] = username;

    // send after user joined chat
    io.emit('userJoined',username, `${username} has joined the chat`);
    // update user status to online 
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting database connection:", err);
        return;
      }
      const sql = `  UPDATE users SET user_online = ? WHERE user_id = ?`;
        const values = [
          1,username
        ]; 
        connection.query(sql,values, (err, result) => {
          if (err) {
            console.error('Error inserting data:', err);
            return;
          }
          connection.release()
        });
    });


    // Read messages
    socket.on('markAsRead', (data) => {
      // Update the database to mark the message as read
      console.log('markAsRead called',data);
      var message = data.messageId;
      var user    = data.user;
      pool.getConnection((err, connection) => {
        if (err) {
          console.error("Error getting database connection:", err);
          return;
        }
        connection.query('SELECT * FROM messages WHERE msg_u_id = ?', [message], (err, rows) => {
          if (err) {
              console.error('Error fetching message:', err);
              return;
          }
      
          // Process the retrieved message
          if (rows.length > 0) {
              // const receiver = rows[0];

              const receiver = rows[0]['msg_rec_id'] 
              const msg_time = rows[0]['msg_time']
              const sender   = rows[0]['msg_user_id']
              if (receiver == user){
                const sql = `  UPDATE messages SET msg_read = ?,msg_type = ?, msg_read_by = ? WHERE msg_u_id = ?`;
                const values = [
                  1,2,user,message
                ]; 
                connection.query(sql,values, (err, result) => {
                  if (err) {
                    console.error('Error inserting data:', err);
                    return;
                  }
                  console.log('Updated data successfully',user);
                  connection.release()
                    io.emit('messageRead', {
                      messageId: message,
                      reader: user,
                      time  :msg_time,
                      sender: sender
                    });
                });
              }

              console.log('Retrieved message:', receiver);
              // Further processing of the retrieved message
          } else {
              console.log('Message not found');
          }
        });
      });
    });
      // markMessageAsRead(messageId);
  

    // Listen for messages from clients
    // and save messages
    socket.on('message', (message,sender,receiver,time,message_id) => {

        console.log('Save message',time);
        pool.getConnection((err, connection) => {
          if (err) {
            console.error("Error getting database connection:", err);
            return;
          }

        // const sql = `INSERT INTO messages (msg_u_id, msg_user_id, msg_rec_id, msg_text, msg_type,msg_read,msg_read_by, msg_time, msg_status, msg_created, msg_updated, msg_is_delete, msg_chat_id,msg_file_id)VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        var table = 'messages'
        // depend on user is online or offline
        let message_type;
        if (message != ''){
          message_type = 1
        }else{
          message_type = 2
        }
        msg_created  = new Date();
        let formattedDate = msg_created.getFullYear() + '-' +
                    ('0' + (msg_created.getMonth() + 1)).slice(-2) + '-' +
                    ('0' + msg_created.getDate()).slice(-2) + ' ' +
                    ('0' + msg_created.getHours()).slice(-2) + ':' +
                    ('0' + msg_created.getMinutes()).slice(-2) + ':' +
                    ('0' + msg_created.getSeconds()).slice(-2);

        let queryString = "INSERT INTO " + table + " (msg_u_id, msg_user_id, msg_rec_id, msg_text, msg_type, msg_read, msg_read_by, msg_time, msg_status, msg_created, msg_updated, msg_is_delete, msg_chat_id_id, msg_file_id) VALUES (" + 
        "'" + message_id + "', " + sender + ", " + receiver + ",'" + message + "', " + message_type + ", 0, NULL, '"+time+"', 1, '" + formattedDate + "', NULL, 0, 1, NULL)";

        // const values = [message_id, sender, receiver, message, message_type,0,null, time, 1, 
        //   msg_created, null, 0, 1, null, null];
        

        connection.query(queryString, (err, result) => {
          if (err) {
            console.error('Error inserting data:', err);
            return;
          }
          console.log('Inserted data successfully');
          connection.release()
        });
      });
      
      // on message receive emit message to the fontend
      io.emit('message', {
        username    :users[socket.id],  
        message     :message,
        sender      :sender,
        receiver    :receiver,
        time        :time,
        message_id  :message_id
      });

      
  });


  // Logout user when disconnect
  socket.on('disconnect', () => {
    const username =   users[socket.id];
    // lasttime      = new Date();
    // let last_seen = lasttime.getFullYear() + '-' +
    //                 ('0' + (lasttime.getMonth() + 1)).slice(-2) + '-' +
    //                 ('0' + lasttime.getDate()).slice(-2) + ' ' +
    //                 ('0' + lasttime.getHours()).slice(-2) + ':' +
    //                 ('0' + lasttime.getMinutes()).slice(-2) + ':' +
    //                 ('0' + lasttime.getSeconds()).slice(-2)
    //                 ('00' + lasttime.getMilliseconds()).slice(-3) + 'Z';
    const lasttime = new Date();
    let last_seen = lasttime.toISOString();
    io.emit('userLeft',username,last_seen, `${users[socket.id]} has left the chat`);
    delete users[socket.id];

      pool.getConnection((err, connection) => {
        if (err) {
          console.error("Error getting database connection:", err);
          return;
        }
        const sql = `  UPDATE users SET user_online = ?,last_seen =? WHERE user_id = ?`;
          const values = [
            0,last_seen,username
          ]; 
          connection.query(sql,values, (err, result) => {
            if (err) {
              console.error('Error inserting data:', err);
              return;
            }
          });
      });
      console.log(username,' user disconnected');
  });
});
});
 




// io.on('connection', (socket) => {
//   console.log('Hello Swapnil connected');
//   socket.on('disconnect', () => {
//     console.log('Bye Bye Swap');
//   });
// });


// io.on('connection', (socket) => {
//   socket.on('chat message', (msg,sender,receiver) => {
//     console.log('message: ' + msg);
//     console.log('sender: ' + sender);
//     console.log('receiver: ' + receiver);
//   });
// // });

// app.get('/logout', (req, res) => {

//   apiUrl    = 'http://127.0.0.1:8000/app/logout';
//   var loginUserDataString = localStorage.getItem('loginUserData');
//   var user                = JSON.parse(loginUserDataString);
//   user_id = user.session_user;
//   authToken = user.session_token
//   const config = {
//     headers: {
//       Authorization: `Bearer ${authToken}` // Adding Authorization header with the token
//     }
//   };
//   axios.post(apiUrl,config)
//         .then(response => {
//           // Handle successful response from Django API
//            console.log(response.data.success);
//           if (response.data.success == 1){
//             res.redirect('/login'); // Replace '/login' with the actual URL of your login page
//           }
//           res.redirect('/login');
          
//     });
// });


// io.on('connection', (socket) => {
//     socket.on('chat message', (msg,sender,receiver) => {
//       const insert_query = `
//         INSERT INTO messages (msg_file_id, msg_u_id, msg_user_id, msg_rec_id, msg_text, msg_type, msg_read, msg_time, msg_created, msg_is_delete)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `;
//       const values = [
//         null,           
//         null,           // msg_u_id
//         sender,  // msg_user_id
//         receiver, // msg_rec_id
//         msg,  // msg_text
//         1,  // msg_type
//         1,               
//         new Date(), 
//         new Date(), 
//         1           
//       ];  
//       pool.getConnection((err, connection) => {
//         if (err) {
//           console.error("Error getting database connection:", err);
//           return;
//         }
//         connection.query(insert_query, values, (err, result) => {
//           if (err) {
//             console.error('Error executing insert query:', err);
//             return;
//           }
//           console.log('Inserted new message with ID:', result.insertId);
//         });
//       });

//         io.emit('chat message', msg,sender,receiver);
//     });
// });



server.listen(3001, () => {
  console.log('listening on *:3001');
});