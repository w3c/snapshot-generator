'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mkdirp = require('mkdirp');

const app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
    res.send('Hello World!')
});

app.post('/', function (req, res) {
    res.send('Got a POST request')
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
                let decodedContent = new Buffer(content, 'base64').toString('utf8');
                let config = JSON.parse(decodedContent);
                console.log('Found repo config file', config);

                // TODO support multiple commits in one push
                let file = `${repo}/${push[0].id}/${config.src_file}`;
                let github_url = `https://raw.githubusercontent.com/${file}`;
                let rawgit_url = `https://rawgit.com/${file}`;
                let snapshots_json = `${__dirname}/public/snapshot/${repo}/snapshots.json`;

                if (config.type === 'bikeshed') {
                    console.log(getBikeshed(github_url));

                    mkdirp(`${__dirname}/public/snapshot/${repo}`, function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            // TODO maybe add a writeToJSON function
                            if (fs.existsSync(snapshots_json)) {
                                fs.readFile(snapshots_json, 'utf8', function readFileCallback(err, data) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        let obj = JSON.parse(data);
                                        obj.snapshots.push({
                                            id: `${push[0].id}`
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
                                    id: `${push[0].id}`
                                });
                                let json = JSON.stringify(obj);
                                fs.writeFile(snapshots_json, json, 'utf8');
                            }
                            download(getBikeshed(github_url), `${__dirname}/public/snapshot/${repo}/${push[0].id}.html`);
                        }
                    });
                } else if (config.type === 'respec') {
                    console.log(getReSpec(rawgit_url));

                    mkdirp(`${__dirname}/public/snapshot/${repo}`, function (err) {
                        if (err) {
                            console.error(err);
                        } else {
                            if (fs.existsSync(`${__dirname}/public/snapshot/${repo}/snapshots.json`)) {
                                fs.readFile(snapshots_json, 'utf8', function readFileCallback(err, data) {
                                    if (err) {
                                        console.log(err);
                                    } else {
                                        let obj = JSON.parse(data);
                                        obj.snapshots.push({
                                            id: `${push[0].id}`
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
                                    id: `${push[0].id}`
                                });
                                let json = JSON.stringify(obj);
                                fs.writeFile(snapshots_json, json, 'utf8');
                            }
                            download(getReSpec(rawgit_url), `${__dirname}/public/snapshot/${repo}/${push[0].id}.html`);
                        }
                    });
                } else {
                    console.log('Error: "type" should be "bikeshed" or "respec"');
                }
            } else {
                console.log('Not Found');
            }

            // console.log(decodedContent);
        });

    }).on('error', (err) => {
        console.log('Error: ' + err.message);
    });

    res.send(`Repository: ${repo}
Commits: ${push}`);
});

function getBikeshed(github_url) {
    return `https://api.csswg.org/bikeshed/?url=${encodeURIComponent(github_url)}`;
}

function getReSpec(rawgit_url) {
    return `https://labs.w3.org/spec-generator/?type=respec&url=${encodeURIComponent(rawgit_url)}`;
}

// https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
function download(url, dest, cb) {
    let file = fs.createWriteStream(dest);
    let request = https.get(url, function (response) {
        response.pipe(file);
        file.on('finish', function () {
            file.close(cb); // close() is async, call cb after close completes.
        });
    }).on('error', function (err) { // Handle errors
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (cb) cb(err.message);
    });
}

app.listen(3000, () => console.log('App listening on port 3000!'));