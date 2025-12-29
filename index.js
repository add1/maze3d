const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

let LEVEL_0_SIZE = 5;
let levels = [];
let game_id = 1;

let playerId = 0;

app.get('/maze', (req, res) => {
  res.sendFile(__dirname + '/maze.html');
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let player_colors = [
  '#fe019a',  // hot pink
  '#888',  //  grey
  '#f88',  // light pink
  '#ff0',  // yellow
  '#f0f',  // magenta
  '#0ff'   // cyan
];

let player_names = [];
let players_complete = [];
let players = {};

MOVE_DISTANCE = 10;
let KEY_REPEAT_DELAY = 10;

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);
  players[socket.id] = { 'id': playerId++ }

  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);
    io.emit('chat message', msg);
  });

  socket.on('maze', (msg, callback) => {
    console.log('message: ', msg, socket.id);
    console.log('players (at start)', player_names);
    if (msg.type === "new maze") {
      if (msg.user.length >= 20) {
        console.log("name too long");
        callback({ "success": false, "error": "Name must be less than 20 characters" });
        return;
      }

      console.log("name exists?:", msg.level, msg.user, player_names, player_names.indexOf(msg.user));
      if (msg.level == 0 && player_names.indexOf(msg.user) >= 0) {
        console.log("name already in use.", player_names);
        console.log(players);
        callback({ "success": false, "error": "Name already in use" });
        return;
      }

      console.log("number of existing players: ", player_names.length);
      if (player_names.length > 5) {
        console.log("Game full.", player_names);
        console.log(players)
        callback({ "success": false, "error": "No open positions" });
        return;
      }

      let player = players[socket.id];

      console.log("msg.level", msg.level);
      if (msg.level == 0) {
        player_names.push(msg.user);
        player['state'] = "playing";
      }

      if (!player.color) {
        player.color = choose(player_colors, true);
        color = player_colors.splice(player_colors.indexOf(player.color), 1);
      }
      console.log("player_names", player_names);
      console.log("new maze", msg.level);
      player['name'] = msg.user.substr(0, 20);
      player['level'] = msg.level;
      player['position-x'] = 30;
      player['position-y'] = 30;
      player.x = 30;
      player.y = 30;
      player.direction_rad = Math.PI / 2; // Default direction
      console.log("new maze", msg.level);
      if (levels.length > msg.level) {
        player['state'] = 'frozen';
        player['duration'] = msg.level == 0 ? 5 : 3;
        console.log("setting ", player.name, " to frozen at level start");
        setTimeout(() => {
          player.state = 'playing';
          console.log("setting ", player.name, " to playing at level start", players[socket.id].state);
          io.emit('player update', players);
        }, player.duration * 1000);
        io.emit('player update', players);
        callback({
          "success": true,
          "game_id": game_id,
          "max_level": levels.length
        },
          levels[msg.level].maze,
          levels[msg.level].dead_ends,
          player);
      } else {
        player['state'] = 'Complete';
        player['position'] = players_complete.length;
        players_complete.push(player.name);
      }
      io.emit('player update', players);

    } else if (msg.type === "user move") {

      observer = players[socket.id]
      if (observer.level === undefined) {
        console.log("Player not initialized yet, ignoring move.");
        return;
      }
      console.log(observer, players)
      key = msg.key;
      shift = msg.shift
      moved = update_position(key, shift, observer, msg.x, msg.y);

      callback({ 'observer': observer, 'moved': moved });
      io.emit('player update', players);

    } else if (msg.type === "power up") {
      if (msg.powerUpType === "freeze_bomb") {
        console.log("FREEZE BOMB:0", players);
        let at_lest_one_player_frozen = false;
        Object.keys(players).forEach((k, idx) => {
          let p = players[k];
          if (k != socket.id) {
            at_lest_one_player_frozen = true;
            p.state = 'frozen';
            p.freeze_duration = msg.duration;
            setTimeout(() => {
              p.state = 'playing';
              io.emit('player update', players);
            }, msg.duration * 1000);
          }
        });
        if (at_lest_one_player_frozen) {
          io.emit('player update', players);
        }
      } else if (msg.powerUpType === "restart") {
        console.log("Reset", players);
        let at_lest_one_player_restated = false;
        Object.keys(players).forEach((k, idx) => {
          let p = players[k];
          if (k != socket.id) {
            p['position-x'] = 30;
            p['position-y'] = 30;
            at_lest_one_player_restated = true;
          }
        });
        if (at_lest_one_player_restated) {
          console.log("make players restart");
          io.emit('player update', players);
        }
      }
    } else {
      console.log("unexpected message:", msg);
    }
    console.log("players", players);
    console.log("players at end", player_names);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected', socket.id, players[socket.id].name, player_names);
    if (player_names.indexOf(players[socket.id].name) >= 0) {
      player_names.splice(player_names.indexOf(players[socket.id].name), 1);
    }
    if (players[socket.id].color) {
      player_colors.push(players[socket.id].color);
    }
    console.log('user disconnected', socket.id, players[socket.id].name, player_names);

    players_complete_indx = players_complete.indexOf(players[socket.id].name);
    if (players_complete_indx >= 0) {
      players_complete.splice(players_complete_indx, 1);
    }

    delete (players[socket.id]);
    io.emit('player update', players);
  });

});

server.listen(3000, () => {
  console.log('listening on *:3000');
});


players = {};

function choose(list, removeFromList) {
  return list[Math.floor(Math.random() * list.length)];
}

function get_unvisited(maze) {
  height = maze.length;
  width = maze[0].length;
  unvisited = [];
  for (y = 1; y < height; y += 2) {
    for (x = 1; x < width; x += 2) {
      if (!maze[y][x].visited) {
        unvisited.push([y, x])
      }
    }
  }
  return unvisited;
}

function choose_unvisited(maze) {
  return choose(get_unvisited(maze))
}

function get_visited(maze) {
  let height = maze.length;
  let width = maze[0].length;
  let visited = [];
  for (y = 1; y < height; y += 2) {
    for (x = 1; x < width; x += 2) {
      if (maze[y][x].visited) {
        visited.push([y, x])
      }
    }
  }
  return visited;
}

function choose_visited(maze) {
  return choose(get_visited(maze))
}

function choose_present(maze) {
  let present = [];
  let height = maze.length;
  let width = maze[0].length;
  for (y = 1; y < height; y += 2) {
    for (x = 2; x < width - 1; x += 2) {
      if (maze[y][x].present) {
        present.push([y, x])
      }
    }
  }
  let chosen = choose(present);
  return choose(present);
}


function make_maze(LEVEL, MAZE_HEIGHT, MAZE_WIDTH) {

  let maze = []
  let dead_ends = [[1, 1]]
  for (y = 0; y < MAZE_HEIGHT; y++) {
    maze_row = []
    for (x = 0; x < MAZE_WIDTH; x++) {
      maze_row.push({ visited: true, present: false, expolored: false, onmap: false });
    }
    maze.push(maze_row);
  }

  for (y = 0; y < MAZE_HEIGHT; y += 2) {
    for (x = 0; x < MAZE_WIDTH; x++) {
      maze[y][x].present = true;
    }
  }

  for (x = 0; x < MAZE_WIDTH; x += 2) {
    for (y = 0; y < MAZE_HEIGHT; y++) {
      maze[y][x].present = true;
    }
  }

  for (y = 1; y < MAZE_HEIGHT; y += 2) {
    for (x = 1; x < MAZE_WIDTH; x += 2) {
      maze[y][x].visited = false;
    }
  }

  x = 1; y = 1; complete = false;
  iterations = 10000;
  while (true) {

    maze[y][x].visited = true;
    directions = []
    possible_directions = [[0, -2], [0, 2], [-2, 0], [2, 0]]

    for (i = 0; i < possible_directions.length; i++) {
      possible_direction = possible_directions[i];

      if ((x + possible_direction[1] < MAZE_WIDTH) &&
        (x + possible_direction[1] > 0) &&
        (y + possible_direction[0] < MAZE_HEIGHT) &&
        (y + possible_direction[0] > 0) &&
        (!maze[y + possible_direction[0]][x + possible_direction[1]].visited)) {
        directions.push(possible_direction);
      }
    }


    if (directions.length == 0) {
      iterations--;
      unvisited = get_unvisited(maze);
      if (unvisited.length == 0) {
        break;
      }
      if (iterations < 0) {
        [y, x] = choose_unvisited(maze);
      } else {
        [y, x] = choose_visited(maze);
      }
      continue;
    }
    direction = choose(directions);
    maze[y + direction[0] / 2][x + direction[1] / 2].present = false;

    x += direction[1];
    y += direction[0];
  }

  for (let i = 0; i < LEVEL / 2 + 1; i++) {
    let bridge_node = choose_present(maze);
    if (bridge_node) {
      maze[bridge_node[0]][bridge_node[1]].present = false;
    }
  }

  maze[MAZE_HEIGHT - 1][MAZE_WIDTH - 1].present = false;
  maze[MAZE_HEIGHT - 2][MAZE_WIDTH - 1].present = false;
  maze[MAZE_HEIGHT - 1][MAZE_WIDTH - 2].present = false;

  for (y = 0; y < MAZE_HEIGHT; y++) {
    line = "";
    for (x = 0; x < MAZE_WIDTH; x++) {
      line += maze[y][x].present ? "#" : " ";
    }
  }

  for (y = 1; y < MAZE_HEIGHT; y += 2) {
    for (x = 1; x < MAZE_WIDTH; x += 2) {
      if ((
        maze[y + 1][x].present +
        maze[y - 1][x].present +
        maze[y][x + 1].present +
        maze[y][x - 1].present) == 3
      ) {
        dead_ends.push([y, x]);
      }
    }
  }
  return { "maze": maze, "dead_ends": dead_ends };
}

function valid_position(maze, y, x) {
  let ypos = Math.floor(y / 20, 0);
  let top = Math.floor((y - 5) / 20, 0);
  let bot = Math.floor((y + 5) / 20, 0);
  let xpos = Math.floor(x / 20, 0);
  let left = Math.floor((x - 5) / 20, 0);
  let right = Math.floor((x + 5) / 20, 0);

  if (maze[ypos][xpos].present ||
    maze[bot][left].present ||
    maze[bot][right].present ||
    maze[top][left].present ||
    maze[top][right].present) {

    return false;
  } else {
    return true;
  }
}

function update_position(key, shift, observer, client_x, client_y) {
  let maze = levels[observer.level].maze;

  // Sync position variables
  if (observer.x === undefined) observer.x = observer['position-x'];
  if (observer.y === undefined) observer.y = observer['position-y'];

  let x_at_start = observer.x;
  let y_at_start = observer.y;
  let direction_at_start_rad = observer.direction_rad;

  if (observer.state === 'frozen') {
    return false;
  }

  // Apply client proposed position if available (Trust Client)
  if (client_x !== undefined && client_y !== undefined) {
    observer.x = client_x;
    observer.y = client_y;

    // Still update direction on server for rotation keys so state is somewhat synced
    if (!shift) {
      if (key == "ArrowRight") observer.direction_rad += Math.PI / 6;
      if (key == "ArrowLeft") observer.direction_rad -= Math.PI / 6;
    }
  } else {
    // Fallback to server calculation if no client pos provided (legacy/compat)
    // calculate new position based on key used.
    if (key == "ArrowRight") {
      if (shift) {
        observer.x += Math.cos(observer.direction_rad) * MOVE_DISTANCE;
        observer.y += Math.sin(observer.direction_rad) * MOVE_DISTANCE;
      } else {
        observer.direction_rad += Math.PI / 6
        KEY_REPEAT_DELAY = 500;
      }
    }
    if (key == "ArrowLeft") {
      if (shift) {
        observer.x -= Math.cos(observer.direction_rad) * MOVE_DISTANCE;
        observer.y -= Math.sin(observer.direction_rad) * MOVE_DISTANCE;
      } else {
        observer.direction_rad -= Math.PI / 6
        KEY_REPEAT_DELAY = 500;
      }
    }

    if (key == "ArrowUp") {
      observer.x += Math.sin(observer.direction_rad) * MOVE_DISTANCE;
      observer.y -= Math.cos(observer.direction_rad) * MOVE_DISTANCE;
    }
    if (key == "ArrowDown") {
      observer.x -= Math.sin(observer.direction_rad) * MOVE_DISTANCE;
      observer.y += Math.cos(observer.direction_rad) * MOVE_DISTANCE;
    }
  }

  if (direction_at_start_rad != observer.direction_rad) {
    // Direction changed
  } else if (observer.x === x_at_start && observer.y === y_at_start) {
    return false;
  }

  // correct for moving outside maze area
  observer.y = Math.min((maze.length - 1) * 20, observer.y);
  observer.x = Math.min((maze[0].length - 1) * 20, observer.x);

  // correct for collision with walls
  if (!valid_position(maze, observer.y, observer.x)) {
    if (valid_position(maze, observer.y, x_at_start) &&
      !((Math.round((observer.direction_rad % Math.PI) / (Math.PI / 2))) % 2)) {
      observer.x = x_at_start;
    } else if (valid_position(maze, y_at_start, observer.x) &&
      ((Math.round((observer.direction_rad % Math.PI) / (Math.PI / 2))) % 2)) {
      observer.y = y_at_start;
    } else {
      observer.x = x_at_start;
      observer.y = y_at_start;
    }
  }

  // correct for collision with other players
  let other_player_in_position = false;
  Object.values(players).forEach(
    (p, indx) => {
      if ((Math.abs(observer.x - p['position-x']) < 10) &&
        (Math.abs(observer.y - p['position-y']) < 10) &&
        (p.level == observer.level) &&
        (p.id != observer.id)
      ) {
        other_player_in_position = true;
      }
    }
  );

  if (other_player_in_position) {
    observer.x = x_at_start;
    observer.y = y_at_start;
    console.log("bump!");
  }

  // Sync back to position-x/y for client compatibility
  observer['position-x'] = observer.x;
  observer['position-y'] = observer.y;

  // update the maze floor with the 'slug trail'
  if (!maze[Math.floor(observer.y / 20, 0)][Math.floor(observer.x / 20, 0)].explored) {
    maze[Math.floor(observer.y / 20, 0)][Math.floor(observer.x / 20, 0)].explored = true;
    if (!maze[Math.floor(observer.y / 20, 0)][Math.floor(observer.x / 20, 0)].onmap) {
      maze[Math.floor(observer.y / 20, 0)][Math.floor(observer.x / 20, 0)].onmap = true;
      // Client side logic for updating map removed
    }
  }

  // is maze is complete
  let mazeHeight = maze.length;
  let mazeWidth = maze[0].length;

  if (observer.x > (mazeWidth - 2) * 20 && observer.y > (mazeHeight - 2) * 20) {
    console.log("Level complete for " + observer.name);
    // next_level(); 
  } else if (x_at_start != observer.x || y_at_start != observer.y || direction_at_start_rad != observer.direction_rad) {
    // Changed to just return true as socket emit logic might handle this or be redundant if logic is on server
  }

  return true;
}



for (level = 1; level <= 10; level++) {
  levels.push(make_maze(level, LEVEL_0_SIZE + 2 * level, LEVEL_0_SIZE + 2 * level));
}

