const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const app = express();
const { Pool } = require('pg');
const dbParams = require('./lib/db.js');
const db = new Pool(dbParams);
db.connect();

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));
app.use(bodyParser.json());
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2']
}));
app.use(morgan('dev'));

let order = ["Fries", "Burger"];

// api endpoint currently queries database to return all restaurants
// may need menu helper to construct a proper object
// to send to front end
app.get('/api/getMenu', (req, res) => {
  const queryConfig = {
    text: `SELECT * FROM restaurants;`,
    values: []
  };
  db.query(queryConfig)
    .then((response) => {
      console.log('Sent list of items');
      res.json(response.rows);
    });
});

app.post('/api/getMenu', (req, res) => {
  order.push(req.body.order);
  console.log('Got an order!\n');
  console.log(req.body);
  res.send('success');
});

app.post('/login', (req, res) => {
  console.log('reached login');
  console.log(req);
});

app.post('/logout', (req, res) => {
  console.log('reached logout');
});

// Handles any requests that don't match the ones above
app.get('*', (req, res) => {
  // res.sendFile(path.join(__dirname+'/client/build/index.html'));
  res.send("nah");
});

const port = process.env.PORT || 5000;
app.listen(port);

console.log('App is listening on port ' + port);