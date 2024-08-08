/*
    VolWeb

    author: @CirilBohak
    organization: @nanovis
*/

import express from 'express';
import pkg from 'pbkdf2-password';
import path from 'path';
import session from 'express-session';
import { actions } from './routes/api/actions.mjs';
import bodyParser from 'body-parser';
import { argv } from 'process';
import { readFileSync } from 'fs';
import cors from 'cors';
import { restrict } from './middleware/restrict.mjs';
import DatabaseManager from "./tools/lowdb-manager.mjs";

const port = argv[2] || 8080;
const app = express(express.json());

// config
const config = JSON.parse(readFileSync('config.json', 'utf8'));
app.set('view engine', 'ejs');
app.set('views', [path.join('.', 'views'), path.join('.', 'views', 'project')]);
const hash = pkg();

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json())
app.use(cors());

app.use(session({
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    secret: 'Nanovis VolWeb'
}));

// Server actions
app.use('/api/actions', actions);

// Session handling
app.use(function (req, res, next) {
    var err = req.session.error;
    var msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});

// DB middleware
const db = DatabaseManager.db;
const users = db.data.users;

// Authenticate user in DB
function authenticate(name, pass, fn) {
    const user = users.find(user => user.username === name);
    if (!user) return fn(new Error('cannot find user'));
    hash({ password: pass, salt: user.passworSalt }, function (err, pass, salt, hash) {
        if (err) return fn(err);
        if (hash === user.passwordHash) return fn(null, user);
        fn(new Error('invalid password'));
    });
}

app.use(express.static('web',  { index: false }));
app.use(express.static('data',  { index: false }));

// Handling root route
app.get('/', restrict, function (req, res) {
    res.redirect('/auth');
});
 
// Handling auth route
app.get('/auth', restrict, function (req, res) {
    // res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
    res.render('actions');
});

// Handling logout route
app.get('/logout', function (req, res) {
    // destroy the user's session to log them out will be re-created next request
    req.session.destroy(function () {
        res.redirect('/');
        // res.send({success: true})
    });
});

// Handling login route
app.get('/login', function (req, res) {
    res.render('login');
});

app.post('/login', function (req, res) {
    authenticate(req.body.username, req.body.password, function (err, user) {
        if (user) {
            // Regenerate session when signing in to prevent fixation
            req.session.regenerate(function () {
                // Store the user's primary key in the session store to be retrieved,
                // or in this case the entire user object
                req.session.user = user;
                res.redirect('/auth');
                // res.send({ success: true });
            });
        } else {
            req.session.error = 'Authentication failed!';
            res.send({ success: false });
            // res.redirect('/login');
        }
    });
});

app.get('/test', function (req, res) {
    console.log("Test request initiated...");
    res.send({ message: 'This is a bit longer test message ...' });
});

// 404 Error
app.use(function(req, res){
    res.status(404);
    res.send({ error: "Sorry, can't find that" })
  });

// Running server
app.listen(port, () => {
    console.log('listening on port ' + port);
})