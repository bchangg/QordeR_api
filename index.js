const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookiesMiddleware = require('universal-cookie-express');
const cors = require("cors");

const { Pool } = require('pg');
const dbParams = require('./lib/db.js');
const db = new Pool(dbParams);
db.connect();

const app = express();

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(cookiesMiddleware());
app.use(morgan('dev'));

let order = ["Fries", "Burger"];

// An api endpoint that returns a short list of items
app.get('/api/getMenu', (req, res) => {
  res.json(order);
  console.log('Sent list of items');
});

app.post('/api/getMenu', (req, res) => {
  order.push(req.body.order);
  console.log('Got an order!\n');
  console.log(req.body);
  res.send('success');
});

app.get('/api/getTables/:restaurantId', (req, res) => {
  const queryConfig = {
    text: `
      SELECT id, completed FROM (
        tables LEFT JOIN (
          SELECT table_id, completed FROM orders WHERE completed = 'f'
        ) AS temp0 ON tables.id = table_id
      ) AS temp1 WHERE restaurant_id = $1;
    `,
    values: [req.params.restaurantId]
  };
  db.query(queryConfig)
    .then((response) => {
      res.send(response.rows);
    })
    .catch((error) => {
      res.send(error);
    });
});

app.get('/api/getActiveTableItems/:tableId', (req, res) => {
  const queryConfig = {
    text: `SELECT id AS order_id FROM orders WHERE table_id = $1 AND completed = FALSE`,
    values: [req.params.tableId]
  };
  db.query(queryConfig)
    .then((response) => {
      const queryConfig = {
        text: `SELECT * FROM order_details WHERE order_id = $1`,
        values: [response.rows[0].order_id]
      };
      db.query(queryConfig)
        .then((response) => {
          const orderDetails = response.rows;
          const itemIds = response.rows.map((entry) => {
            return entry.item_id;
          });
          const queryConfig = {
            text: `SELECT id, name FROM items WHERE id IN (${itemIds.map((itemId, index) => {
              return `$${index + 1}`;
            }).join(', ')})`,
            values: itemIds
          };
          db.query(queryConfig)
            .then((response) => {
              const orderItems = response.rows;
              orderDetails.forEach((orderDetail) => {
                orderDetail["item_name"] = (orderItems.find((orderItem) => {
                  return orderItem.id === orderDetail.item_id;
                }).name);
              });
              res.send(orderDetails);
            });
        });
    })
    .catch((error) => {
      res.send(error);
    });
});

app.post('/api/upgradeStatus/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const queryConfig = {
    text: "SELECT time_accepted FROM order_details WHERE id = $1",
    values: [orderId]
  };
  db.query(queryConfig)
    .then((response) => {
      const queryConfig = {
        text: '',
        values: []
      };
      if (!response.rows[0].time_accepted) {
        queryConfig.text = "UPDATE order_details SET time_accepted=NOW() WHERE id = $1 RETURNING time_accepted";
        queryConfig.values = [orderId];
        db.query(queryConfig)
          .then((response) => {
            res.send('success: time_accepted');
          })
          .catch((error) => {
            res.send('failure: time_accepted');
          });
      } else if (!response.rows[0].time_completed) {
        queryConfig.text = "UPDATE order_details SET time_completed=NOW() WHERE id = $1 RETURNING time_completed";
        queryConfig.values = [orderId];
        db.query(queryConfig)
          .then((response) => {
            res.send('success: time_completed');
          })
          .catch((error) => {
            res.send('failure: time_completed');
          });
      }
    })
    .catch((error) => {
      console.error(error);
    });
});

app.post('/login', (req, res) => {
  const user = req.body.email;
  const password = req.body.password;
  const queryConfig = {
    text: `SELECT id, password FROM restaurants WHERE username = $1 AND password = $2`,
    values: [user, password]
  };
  db.query(queryConfig)
    .then((response) => {
      const restaurantId = response.rows[0].id;
      // req.universalCookies.set('user', restaurantId);
      // res.send(`/admin/${restaurantId}`);
      console.log(`restaurantId: ${restaurantId}`);
      res.send({ restaurantId });
    })
    .catch((error) => {
      res.send("error");
    });
});

app.post('/logout', (req, res) => {
  res.send(`/admin`);
});

app.get('/restaurant/:id', (req, res) => {
  const queryConfig = {
    text: "SELECT * FROM tables WHERE restaurant_id = $1",
    values: [req.params.id]
  };
});

app.get('/:table_id', (req, res) => { //creates new order is table is empty or adds to current order
  const queryConfig = {
    text: "SELECT current_number_customers FROM tables WHERE id = $1",
    values: [req.params.table_id]
  };
  db.query(queryConfig)
    .then((response) => {
      // const restaurantId = response.rows[0].id;
      const customers = response.rows[0].current_number_customers;
      console.log(customers);
      if (customers === 0) {
        const queryConfig = {
          text: "INSERT into orders (table_id, completed) VALUES ($1, FALSE) RETURNING id",
          values: [req.params.table_id]
        };
        db.query(queryConfig)
          .then(
            (response) => {
              const queryConfig = {
                text: `UPDATE tables SET current_number_customers = 1 WHERE id = $1`,
                values: [req.params.table_id]
              };
              db.query(queryConfig);
              res.send(response.rows[0]);
            });
      } else {
        const queryConfig = {
          text: "SELECT id FROM orders WHERE table_id = $1 AND completed = FALSE",
          values: [req.params.table_id]
        };
        db.query(queryConfig)
          .then((response) => {
            const queryConfig = {
              text: `UPDATE tables SET current_number_customers = ${customers + 1} WHERE id = $1`,
              values: [req.params.table_id]
            };
            db.query(queryConfig);
            res.send(response.rows[0]);
          });
      }
      // req.session.user = restaurantId;
      // res.send(`/restaurant/${restaurantId}`);
    });
});

app.post('/:table_id/order', (req, res) => { // accepts array called orders [{item_id, quantity}] and adds to database
  const queryConfig = {
    text: "SELECT id FROM orders WHERE table_id = $1 AND completed = FALSE",
    values: [req.params.table_id]
  };
  console.log(`table id: ${req.params.table_id}`);
  db.query(queryConfig)
    .then((response) => {
      console.log(`order id: ${response.rows[0].id}`);
      console.log(`body: ${req.body.order}`);
      for (let item of req.body.order) {
        const queryConfig = {
          text: "INSERT into order_details (item_id, order_id, quantity) VALUES ($1, $2, $3)",
          values: [item.id, response.rows[0].id, item.quantity]
        };
        db.query(queryConfig)
          .then(() => {
            console.log(`item id: ${item.id}, item quantity: ${item.quantity}`);
            if (req.body.order[req.body.order.length - 1].id === item.id) {
              res.send("success");
            }
          });
      }
    });
});

app.get('/:table_id/order', (req, res) => {
  const queryConfig = {
    text: "SELECT item_id, quantity, items.name, items.price_cents FROM order_details JOIN items ON items.id = item_id WHERE order_id = (SELECT id FROM orders WHERE table_id = $1 AND completed = FALSE)",
    values: [req.params.table_id]
  };
  db.query(queryConfig)
    .then(response => {
      res.send(response.rows);
    });
});

app.get('/api/:restaurant_id/menu', (req, res) => { // gets menu from database
  const queryConfig = {
    text: "SELECT name, id FROM categories WHERE restaurant_id = $1 AND active",
    values: [req.params.restaurant_id]
  };
  db.query(queryConfig)
    .then((response) => {
      let categories = response.rows;
      const queryConfig = {
        text: "SELECT * FROM categories JOIN items ON categories.id = items.category_id WHERE restaurant_id = $1",
        values: [req.params.restaurant_id]
      };
      db.query(queryConfig)
        .then((response) => {
          let menu = [];
          for (let category of categories) {
            let categoryItems = response.rows.filter(item => item.category_id === category.id);
            menu.push({ category: category.name, items: categoryItems });
          }
          res.send(menu);
        });
    });
});

app.post('/api/:restaurant_id/menu', (req, res) => { //recieves [{category,items}, {category,items}] adds it to database and sets old items active to false
  const queryConfig = {
    text: "UPDATE items SET active = FALSE FROM categories WHERE categories.restaurant_id = $1",
    values: [req.params.restaurant_id]
  };
  db.query(queryConfig)
    .then(() => {
      const queryConfig = {
        text: "UPDATE categories SET active = FALSE WHERE restaurant_id = $1",
        values: [req.params.restaurant_id]
      };
      db.query(queryConfig)
        .then(() => {
          let categoryString = 'INSERT INTO categories (restaurant_id, name, active) VALUES ';
          for (let category of req.body.menu) {
            categoryString += `( $1, '${category.category}', true),`;
          }
          categoryString = categoryString.slice(0, -1);
          categoryString += ' RETURNING id';
          const queryConfig = {
            text: categoryString,
            values: [req.params.restaurant_id]
          };
          db.query(queryConfig)
            .then((response) => {
              for (let index = 0; index < response.rows.length; index++) {
                let itemString = 'INSERT INTO items (category_id, name, price_cents, image, active) VALUES ';
                for (let item of req.body.menu[index].items) {
                  itemString += `('${response.rows[index].id}', '${item.name}', ${item.price_cents}, '${item.image}', true),`;
                }
                itemString = itemString.slice(0, -1);
                db.query(itemString)
                  .then(() => {
                    if (index === response.rows.length - 1) {
                      res.send("success");
                    }
                  });
              }
            });
        });
    });
});

// Handles any requests that don't match the ones above
app.get('*', (req, res) => {
  // res.sendFile(path.join(__dirname+'/client/build/index.html'));
  res.send("nah");
});

const port = process.env.PORT || 5000;
app.listen(port);

console.log('App is listening on port ' + port);