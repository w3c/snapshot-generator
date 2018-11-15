'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mkdirp = require('mkdirp');
const winston = require('winston');

const app = express();
const today = new Date();
const year = today.getFullYear();
const month = (today.getMonth() + 101).toString().substr(1, 2);
const day = (today.getDate() + 100).toString().substr(1, 2);
const filename = `log/${year}-${month}-${day}.log`;
const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({level: 'info', json: false}),
        new winston.transports.File({level: 'info', json: false, filename: filename})
    ]
});

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.send('Hello World!');
});

app.post('/', function (req, res) {
    res.send('Got a POST request');
});

app.post('/payload', function (req, res) {
    let push = req.body.commits;
    let repo = req.body.repository.full_name;

    // https://developer.github.com/v3/repos/contents/
    // https://api.github.com/repos/${repo}/contents/.snapshot.json
    // https://developer.github.com/v3/#user-agent-required
    // let options_snapshot = {
    //     hostname: 'api.github.com',
    //     port: 443,
    //     path: `/repos/${repo}/contents/.snapshot.json`,
    //     method: 'GET',
    //     headers: {
    //         'User-Agent': 'W3C Commit Snapshot Generator'
    //     }
    // };

    // https://developer.github.com/v3/repos/contents/
    // https://api.github.com/repos/${repo}/contents/.pr-preview.json
    // https://developer.github.com/v3/#user-agent-required
    let options_pr = {
        hostname: 'api.github.com',
        port: 443,
        path: `/repos/${repo}/contents/.pr-preview.json`,
        method: 'GET',
        headers: {
            'User-Agent': 'W3C Commit Snapshot Generator'
        }
    };

    https.get(options_pr, (resp) => {
        let data = '';

        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            let content = JSON.parse(data).content;
            if (content) {
                let decodedContent = Buffer.from(content, 'base64').toString('utf8');
                let config = JSON.parse(decodedContent);
                logger.debug('Found repo config file ', config);

                // TODO support multiple commits in one push
                let file = `${repo}/${push[0].id}/${config.src_file}`;
                let github_url = `https://raw.githubusercontent.com/${file}`;
                let githack_url = `https://raw.githack.com/${file}`;
                let snapshots_json = `${__dirname}/public/snapshot/${repo}/snapshots.json`;

                if (config.type === 'bikeshed') {
                    logger.debug(getBikeshed(github_url));

                    mkdirp(`${__dirname}/public/snapshot/${repo}`, function (err) {
                        if (err) {
                            logger.error(err);
                        } else {
                            // TODO maybe add a writeToJSON function
                            if (fs.existsSync(snapshots_json)) {
                                fs.readFile(snapshots_json, 'utf8', function readFileCallback(err, data) {
                                    if (err) {
                                        logger.debug(err);
                                    } else {
                                        let obj = JSON.parse(data);
                                        obj.snapshots.push({
                                            id: `${push[0].id}`,
                                            message: `${push[0].message}`,
                                            timestamp: `${push[0].timestamp}`,
                                            url: `${push[0].url}`
                                        });
                                        let json = JSON.stringify(obj);
                                        fs.writeFile(snapshots_json, json, 'utf8');
                                    }
                                });
                            } else {
                                let obj = {
                                    snapshots: []
                                };
                                obj.snapshots.push({
                                    id: `${push[0].id}`,
                                    message: `${push[0].message}`,
                                    timestamp: `${push[0].timestamp}`,
                                    url: `${push[0].url}`
                                });
                                let json = JSON.stringify(obj);
                                fs.writeFile(snapshots_json, json, 'utf8');
                            }
                            download(getBikeshed(github_url), `${__dirname}/public/snapshot/${repo}/${push[0].id}.html`);
                        }
                    });
                } else if (config.type === 'respec') {
                    logger.debug(getReSpec(githack_url));

                    mkdirp(`${__dirname}/public/snapshot/${repo}`, function (err) {
                        if (err) {
                            logger.error(err);
                        } else {
                            if (fs.existsSync(`${__dirname}/public/snapshot/${repo}/snapshots.json`)) {
                                fs.readFile(snapshots_json, 'utf8', function readFileCallback(err, data) {
                                    if (err) {
                                        logger.debug(err);
                                    } else {
                                        let obj = JSON.parse(data);
                                        obj.snapshots.push({
                                            id: `${push[0].id}`,
                                            message: `${push[0].message}`,
                                            timestamp: `${push[0].timestamp}`,
                                            url: `${push[0].url}`
                                        });
                                        let json = JSON.stringify(obj);
                                        fs.writeFile(snapshots_json, json, 'utf8');
                                    }
                                });
                            } else {
                                let obj = {
                                    snapshots: []
                                };
                                obj.snapshots.push({
                                    id: `${push[0].id}`,
                                    message: `${push[0].message}`,
                                    timestamp: `${push[0].timestamp}`,
                                    url: `${push[0].url}`
                                });
                                let json = JSON.stringify(obj);
                                fs.writeFile(snapshots_json, json, 'utf8');
                            }
                            download(getReSpec(githack_url), `${__dirname}/public/snapshot/${repo}/${push[0].id}.html`);
                        }
                    });
                } else {
                    logger.debug('Error: "type" should be "bikeshed" or "respec"');
                }
            } else {
                logger.debug('Not Found');
            }

            // logger.debug(decodedContent);
        });

    }).on('error', (err) => {
        logger.debug('Error: ' + err.message);
    });

    res.send(`Repository: ${repo}
Commits: ${push}`);
});

function getBikeshed(github_url) {
    return `https://api.csswg.org/bikeshed/?url=${encodeURIComponent(github_url)}`;
}

function getReSpec(githack_url) {
    return `https://labs.w3.org/spec-generator/?type=respec&url=${encodeURIComponent(githack_url)}`;
}

// https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
function download(url, dest, cb) {
    let file = fs.createWriteStream(dest);
    https.get(url, function (response) {
        response.pipe(file);
        file.on('finish', function () {
            file.close(cb); // close() is async, call cb after close completes.
        });
    }).on('error', function (err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (cb) cb(err.message);
    });
}

app.listen(3000, () => logger.debug('App listening on port 3000!'));