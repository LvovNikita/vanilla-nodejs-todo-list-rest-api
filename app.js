// ----- ROUTES: 
// + / — список задач [JSON], 
// + /:id — информация о конкретной задаче [JSON];
// + /:id/edit — внесение правок в задачу + пересохранение файла JSON [HTML];
// + /add — добавление задачи + пересохранение файла JSON [HTML];
// + /:id/remove — удаление задачи + пересохранение файла JSON.

// TODO: /:id/remove — заменить на /:id/edit с методом DELETE
// вместо /add можно / с методом POST

const http = require('http');
const fs = require('fs');
const { url } = require('inspector');
const { parse } = require('path');

const todos = JSON.parse(fs.readFileSync('data.json').toString());

const server = http.createServer((req, res) => {
    const url_parts = req.url.split('/').splice(1, req.url.length);
    // ----- ID CHECK ----- 
    const isValidId = typeof +url_parts[0] === 'number' && +url_parts[0] <= todos.length && +url_parts != 0;
    // typeof +url_parts[0] === 'number' — если первый компонент пути — число
    // +url_parts <= todos.length — если это число меньше, чем длина массива с задачами
    // +url_parts != 0 — фикс для нуля (т.к. задачи с id = 0 нет)
    // ----- MAIN PAGE REQUEST -----
    if (req.url === '/' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.write(JSON.stringify(todos, null, 2));    
    } else {
        // ----- OTHER PAGES REQUESTS -----
        // ----- /:ID REQUEST -----
        if (url_parts.length === 1 && isValidId  && req.method === 'GET') {
            // TODO: искать по id, а не по порядковому номеру!
            let id = +url_parts[0] - 1;
            let todo = todos[id];
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify(todo, null, 2));
        // ----- /:ID/EDIT REQUEST
        } else if (url_parts.length === 2 && isValidId && url_parts[1] == 'edit') {
            // url_parts.length === 1 — если путь состоит из одного компонента
            if (req.method === 'GET') {
                let id = +url_parts[0] - 1;
                let todo = todos[id];
                res.setHeader('Content-Type', 'text/html');
                res.write(`
                    <h1>Task id: ${todo.id}</h1>
                    <form method="POST" action="/${todo.id}/edit">
                        <input type="text" name="userId" value="${todo.userId}"> userId<br><br>
                        <input type="text" name="title" value="${todo.title}"> title<br><br>
                        <input type="text" name="completed" value="${todo.completed}"> completed<br><br>
                        <button type="submit">Save</button>
                        <button formaction="/${todo.id}/remove">Remove</button> 
                    <form>
                `)
            };
            if (req.method === 'POST') {
                // ----- REDIRECT AFTER POST -----
                res.writeHead(301, {location: '/'});
                // ----- BODY PARSING -----
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                }); 
                req.on('end', () => {
                    // См. функцию parseBody()
                    let parsed_body = parseBody(body);
                    let id = +url_parts[0];
                    // ----- UPDATE TASK RECORD -----
                    // Объект выглядит следующим образом: {id: ..., userId: ..., completed: ..., new_field: ...}
                    todos[id] = {
                        id, 
                        ...parsed_body
                    }; 
                    console.log(todos[id]);
                    // ----- SAVING CHANGES TO DB (JSON FILE) -----
                    fs.writeFileSync('data.json', JSON.stringify(todos, null, 2));
                });
            };
        // ----- /ADD 'GET' + 'POST' REQUESTS
        } else if (url_parts.length === 1 && url_parts[0] == 'add') {
            if (req.method == 'GET') {
                res.setHeader('Content-Type', 'text/html');
                res.write(`
                    <head>
                        <meta charset="utf-8">
                    </head>
                    <body>
                        <h1>Create New Task</h1>
                        <form method="POST" action="/add">
                            <input type="text" name="userId"> userId<br><br>
                            <input type="text" name="title"> title<br><br>
                            <input type="text" name="completed"> completed<br><br>
                            <button type="submit">Save</button> 
                        <form>
                    </body>
                `)
            };
            if (req.method === 'POST') {
                res.writeHead(301, {'location': '/'});
                let body = [];
                // TODO: id последней задачи + 1
                let id = todos.length + 1;
                req.on('data', (chunk) => {
                    body.push(chunk); 
                });
                req.on('end', () => {
                    let parsed_body = parseBody(body);
                    // ----- ADDING NEW TASK TO DB (JSON FILE) -----
                    let todo = {...parsed_body};
                    todo.id = +todos[todos.length-1].id + 1;
                    todos.push(todo);
                    fs.writeFileSync('data.json', JSON.stringify(todos, null, 2), 'utf8');
                });
            };
        // ----- /:ID/REMOVE 'POST' REQUEST -----
        } else if (url_parts.length === 2 && isValidId && url_parts[1] == 'remove' && req.method === 'POST') {
            res.writeHead(301, {location: '/'});
            let id = +url_parts[0] - 1;
            todos.splice(id, 1);
            fs.writeFileSync('data.json', JSON.stringify(todos, null, 2), 'utf8');
        // ----- 404 PAGE -----
        } else {
            res.setHeader('Content-Type', 'text/html');
            res.statusCode = 404;
            res.write(`
                <h1>404</h1>
                <h2>Page doesn't exist</h2>
                <hr>
                <a href="/">Home page</a>
                <a href="/add">Add new task</a>
                <hr>
                <p>/{id}/edit - to edit task</p>
                <p>/{id}/remove - to remove task</p>
            `);
        }
    };
    // Т.к. браузер каждый раз автоматически пытатется получить доступ к favicon.ico
    // не будем выводить соответствующие сообщения в логи
    req.url !== '/favicon.ico' ? console.log(req.method, req.url) : null;
    res.end();
})

server.listen(3000);

// ----- BODY PARSER
// Разрезаем строку вида key=value&key2=long+value&key3=very+long+value 
// и сохраняем в объект типа {key: 'value', ... key3: 'very long value'}
// TODO: не учтены типы данных!

const parseBody = function(body) {
    let parsed_body = {};
    for (entry of body.toString().split('&')) {
        entry = entry.split('=').map((x) => {return x.replace(/\+/g, ' ')});
        let property = entry[0];
        let value = entry[1];
        parsed_body[property] = value;
    };
    return parsed_body;
};