const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

let LEVEL_0_SIZE=5;
let levels=[];
let game_id = 1;

let playerId=0;

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

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);
  players[socket.id] = {'id':playerId++}

  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);
    io.emit('chat message', msg);
  });

  socket.on('maze', (msg, callback) => {
    console.log('message: ', msg, socket.id);
    console.log('players (at start)', player_names);
    if (msg.type==="new maze") {
        if ( msg.user.length >= 20 ) {
            console.log("name too long");
            callback({"success": false, "error" : "Name must be less than 20 characters"});
            return;
        }

        console.log("name exists?:", msg.level, msg.user, player_names, player_names.indexOf(msg.user));
        if (msg.level==0 && player_names.indexOf(msg.user) >= 0) {
            console.log("name already in use.", player_names);
            console.log(players)
            callback({"success": false, "error" : "Name already in use"});
            return;
        }

        console.log("number of existing players: ", player_names.length);
        if (player_names.length>5) {
            console.log("Game full.", player_names);
            console.log(players)
            callback({"success": false, "error" : "No open positions"});
            return;
        }

        console.log("msg.level", msg.level);
        if (msg.level==0) {
            players[socket.id].color = choose(player_colors, true);
            color = player_colors.splice(player_colors.indexOf(players[socket.id].color),1);
            player_names.push(msg.user);
            players[socket.id]['state']="playing";
        }
        console.log("player_names", player_names);
        console.log("new maze", msg.level);
        players[socket.id]['name']=msg.user.substr(0,20);
        players[socket.id]['level']=msg.level;
        players[socket.id]['position-x']=30;
        players[socket.id]['position-y']=30;
        console.log("new maze", msg.level);
        if (levels.length > msg.level) {
            callback({
                "success" : true, 
                "game_id" : game_id, 
                "max_level": levels.length},
                levels[msg.level].maze, 
                levels[msg.level].dead_ends, 
                players[socket.id]);
        } else {
            players[socket.id]['state']='Complete';
            players[socket.id]['position']=players_complete.length;
            players_complete.push(players[socket.id].name);
        }
        io.emit('player update', players);

    } else if (msg.type==="user move") {
        console.log("new position");
        players[socket.id]['position-x']=msg.x;
        players[socket.id]['position-y']=msg.y;
        io.emit('player update', players);
    } else {
        console.log("unexpected message:", msg);
    }
    console.log("players", players);
    console.log("players at end", player_names);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected', socket.id, players[socket.id].name, player_names);
    if (player_names.indexOf(players[socket.id].name)>=0) {
      player_names.splice(player_names.indexOf(players[socket.id].name),1);
    }
    if (players[socket.id].color) {
        player_colors.push(players[socket.id].color); 
    }
    console.log('user disconnected', socket.id, players[socket.id].name, player_names);

    players_complete_indx=players_complete.indexOf(players[socket.id].name);
    if (players_complete_indx>=0) {
      players_complete.splice(players_complete_indx,1);
    }

    delete(players[socket.id]);
    io.emit('player update', players);
  });
  
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});


players={};

  function choose(list, removeFromList) {
    return list[Math.floor(Math.random()*list.length)];
  }

  function get_unvisited(maze) {
    height=maze.length;
    width=maze[0].length;
    unvisited=[];
    for (y=1; y<height; y+=2) {
      for (x=1; x<width; x+=2) {
        if (!maze[y][x].visited) {
          unvisited.push( [y,x])
        }
      }
    }
    return unvisited;
  }

  function choose_unvisited(maze) {
    return choose(get_unvisited(maze))
  }

  function get_visited(maze) {
    let height=maze.length;
    let width=maze[0].length;
    let visited=[];
    for (y=1; y<height; y+=2) {
      for (x=1; x<width; x+=2) {
        if (maze[y][x].visited) {
          visited.push( [y,x])
        }
      }
    }
    return visited;
  }

  function choose_visited(maze) {
    return choose(get_visited(maze))
  }

  function choose_present(maze) {
    let present=[];
    let height=maze.length;
    let width=maze[0].length;
    for (y=1; y<height; y+=2) {
      for (x=2; x<width-1; x+=2) {
        if (maze[y][x].present) {
          present.push([y,x])
        }
      }
    }
    let chosen = choose(present);
    return choose(present);
  }


  function make_maze(LEVEL, MAZE_HEIGHT, MAZE_WIDTH) {

      let maze=[]
      let dead_ends=[[1,1]]
      for (y=0; y<MAZE_HEIGHT; y++) {
        maze_row=[]
        for (x=0; x<MAZE_WIDTH; x++) {
          maze_row.push({visited:true, present:false, expolored:false, onmap:false});
        }
        maze.push(maze_row);
      }

      for (y=0; y<MAZE_HEIGHT; y+=2) {
        for (x=0; x<MAZE_WIDTH; x++) {
          maze[y][x].present=true;
        }
      }

      for (x=0; x<MAZE_WIDTH; x+=2) {
        for (y=0; y<MAZE_HEIGHT; y++) {
          maze[y][x].present=true;
        }
      }

      for (y=1; y<MAZE_HEIGHT; y+=2) {
        for (x=1; x<MAZE_WIDTH; x+=2) {
          maze[y][x].visited=false;
        }
      }

      x=1; y=1; complete=false;
      iterations=10000;
      while (true) {

         maze[y][x].visited=true;
         directions = []
         possible_directions=[ [0, -2], [ 0, 2], [ -2 , 0], [2, 0] ]

         for (i=0; i< possible_directions.length; i++) {
           possible_direction=possible_directions[i];

           if ( ( x + possible_direction[1] < MAZE_WIDTH ) && 
                ( x + possible_direction[1] > 0 ) &&
                ( y + possible_direction[0] < MAZE_HEIGHT ) &&
                ( y + possible_direction[0] > 0 ) &&
                ( ! maze[y+possible_direction[0]][x+possible_direction[1]].visited)) {
              directions.push(possible_direction);
            }
         }


         if (directions.length==0) {
           iterations--;
           unvisited=get_unvisited(maze);
           if (unvisited.length==0) {
             break;
           }
           if (iterations<0) {
             [y,x] = choose_unvisited(maze);
           } else {
             [y,x] = choose_visited(maze);
           }
           continue;
         }
         direction=choose(directions);
         maze[y+direction[0]/2][x+direction[1]/2].present=false;

         x += direction[1];
         y += direction[0];
      }

      for (let i=0; i<LEVEL/2+1;i++) {
        let bridge_node = choose_present(maze);
        if (bridge_node) {
          maze[bridge_node[0]][bridge_node[1]].present=false;
        }
      }

      maze[MAZE_HEIGHT-1][MAZE_WIDTH-1].present=false;
      maze[MAZE_HEIGHT-2][MAZE_WIDTH-1].present=false;
      maze[MAZE_HEIGHT-1][MAZE_WIDTH-2].present=false;

      for (y=0; y<MAZE_HEIGHT; y++) {
        line="";
        for (x=0; x<MAZE_WIDTH; x++) {
           line += maze[y][x].present?"#":" ";
        }
      }

      for (y=1; y<MAZE_HEIGHT; y+=2) {
        for (x=1; x<MAZE_WIDTH; x+=2) {
          if ( (
            maze[y+1][x].present +
            maze[y-1][x].present +
            maze[y][x+1].present +
            maze[y][x-1].present) == 3
          ) {
            dead_ends.push([y,x]);
          }
        }
      }
      return { "maze": maze, "dead_ends": dead_ends };
  }


for (level=1; level<=10; level++) {
    levels.push(make_maze(level, LEVEL_0_SIZE+2*level, LEVEL_0_SIZE+2*level));
}
