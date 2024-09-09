/*
    VolWeb

    author: @CirilBohak
    organization: @nanovis
*/

import express from 'express';
import path from 'path';
import session from 'express-session';
import { actions } from './routes/api/actions.mjs';
import bodyParser from 'body-parser';
import { argv } from 'process';
import cors from 'cors';
import { restrict } from './middleware/restrict.mjs';
import {UserController} from "./controllers/user-controller.mjs";

const port = argv[2] || 8080;
const app = express(express.json());

// config
app.set('view engine', 'ejs');
app.set('views', [path.join('.', 'views'), path.join('.', 'views', 'project')]);

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
app.get('/logout', UserController.logout);

// Handling login route
app.get('/login', function (req, res) {
    res.render('login');
});

app.post('/login', UserController.login);

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