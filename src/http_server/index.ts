import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

const __dirname = path.resolve(path.dirname(''));

export const httpServer = http.createServer((req, res) => {
    const file_path = path.join(__dirname, req.url === '/' ? '/front/index.html' : `/front${req.url}`);
    fs.readFile(file_path, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }
        res.writeHead(200);
        res.end(data);
    });
});
