DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_details CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;

CREATE Table restaurants (
  id SERIAL PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE Table tables (
  id SERIAL PRIMARY KEY NOT NULL,
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE Table categories (
  id SERIAL PRIMARY KEY NOT NULL,
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  active BOOLEAN
);

CREATE Table items (
  id SERIAL PRIMARY KEY NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price_cents INTEGER NOT NULL,
  image VARCHAR(255) NOT NULL,
  active BOOLEAN
);

CREATE Table orders (
  id SERIAL PRIMARY KEY NOT NULL,
  table_id INTEGER REFERENCES tables(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  order_total_cents INTEGER NOT NULL,
  payment_total_cents INTEGER NOT NULL,
  time_ordered timestamp NOT NULL,
  time_accepted timestamp NOT NULL,
  time_completed timestamp NOT NULL
);

CREATE Table order_details (
  id SERIAL PRIMARY KEY NOT NULL,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL
);

CREATE Table payments (
  id SERIAL PRIMARY KEY NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  payment_cents INTEGER NOT NULL
);
