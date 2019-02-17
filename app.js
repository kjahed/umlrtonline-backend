#!/usr/bin/env nodejs
const express = require('express')
const queue = require('express-queue');
const multer  = require('multer')
const fs = require('fs')
const mv = require('mv')
const rimraf = require("rimraf");
const spawn = require('child_process').spawn
const zipFolder = require('zip-folder')
const querystring = require('querystring');
const extractZip = require('extract-zip')
const md5File = require('md5-file')
const find = require('find')

const app = express()
//app.use(queue({ activeLimit: 5, queuedLimit: -1 }))

const expressWs = require('express-ws')(app)
const pty = require('pty.js');
const port = 3000

const upload = multer( { dest: 'uploads/' } )

app.post('/upload', upload.single('file'), function(req, res, next) {
  const workspaceID = req.file.filename
  const workspace = 'workspaces/' + workspaceID ;
  const  modelFile = workspace + '/model.uml'
  fs.mkdirSync(workspace);

  if(req.file.originalname.endsWith('zip')) {
    extractZip(req.file.path, {dir: __dirname + '/' +  workspace}, 
      function (err) {
        if(err)
          return res.status(500).send()
  
        var umlFiles = find.fileSync(/\.uml$/, workspace);
        if(umlFiles.length < 1)
          return res.status(500).send()

        mv(umlFiles[0] , modelFile, function (err) {
          if(err)
            return res.status(500).send()
          return res.status(200).send(workspaceID)
        });
      });
  } else if(req.file.originalname.endsWith('uml')) {
    mv(req.file.path , modelFile, function (err) {
      if(err)
        return res.status(500).send()
      return res.status(200).send(workspaceID)
    })
  } else
    return res.status(500).send()
})

app.post('/push/:workspaceID', upload.single('file'), function(req, res, next) {
  const workspaceID = req.params.workspaceID
  const workspace = 'workspaces/' + workspaceID 

  return res.status(200).send()
})

app.get('/generate/:workspaceID', function(req, res){
  const workspaceID = req.params.workspaceID
  const workspace = 'workspaces/' + workspaceID
  const modelFile = workspace + '/model.uml'
  const sourceDir = workspace + '/generated/src'
  const modelID = md5File.sync(modelFile);
  const zipFile = 'generated/' + modelID + '.zip'

  if(fs.existsSync(zipFile)) {
    extractZip(zipFile, {dir: __dirname + '/' + sourceDir}, function (err) {
      if(err)
        return res.status(500).send()
      return res.status(200).send()
    }) 
  } else {
    const codegen = spawn('java',  ['-jar', 'bin/codegen.jar', '-p', 'bin/plugins', '-o', workspace + '/generated', modelFile]);
  
    codegen.on('close', function (code) {
      if(code == 0) {
        zipFolder(sourceDir, zipFile, function(err) {
          if(err) {
            rimraf(workspace, function(){});
            return res.status(500).send()
          } else {
            return res.status(200).send()
          }
        });
      } else {
        rimraf(workspace, function(){});
        return res.status(500).send()
      }
    });
  }
})

app.get('/build/:workspaceID', function(req, res){
  const workspaceID = req.params.workspaceID
  const workspace = 'workspaces/' + workspaceID
  const sourceDir = workspace + '/generated/src'
  const umlrtsDir = __dirname + '/' + 'bin/plugins/org.eclipse.papyrusrt.rts_1.0.0.201707181457/umlrts'

  var env = Object.create( process.env );
  env.UMLRTS_ROOT = umlrtsDir;
  const builder = spawn('/usr/bin/make', ['-C', sourceDir], {env : env})
  builder.stderr.pipe(builder.stdout);

  var output = ''
  builder.stdout.setEncoding('utf8');
  builder.stdout.on('data', (data) => {
    output += data
  });

  builder.on('close', function (code) {
    if(code == 0) {
      return res.status(200).send({error: false, output: output})
    } else {
      rimraf(workspace, function(){});
      return res.status(200).send({error: true, output: output})
    }
  });
});

app.get('/download/:workspaceID', function(req, res){
  const workspaceID = req.params.workspaceID
  const workspace = 'workspaces/' + workspaceID
  const modelFile = workspace + '/model.uml'
  const modelID = md5File.sync(modelFile);
  const zipFile = 'generated/' + modelID + '.zip'

  if (fs.existsSync(zipFile)) {
    res.download(zipFile, "generated-code.zip");
  } else {
    return res.status(404).send()
  }
})

app.ws('/attach/:workspaceID', function(ws, req) {
  const workspaceID = req.params.workspaceID
  const workspace = 'workspaces/' + workspaceID

  const shell = pty.spawn('/usr/bin/docker', ['run', '--name', workspaceID, '-ti', '--rm', '--user', 'user', '--entrypoint', '/bin/bash', '-w', '/home/user/workspace', '-v', __dirname + '/workspaces/' + workspaceID + '/generated/src:/home/user/workspace', 'runumlrt_sandbox'])

  shell.on('data', (data) => {
    ws.send(data);
  });
      
  ws.on('message', (msg) => {
    shell.write(msg);
  });
  
  ws.on('close', function (code) {
    spawn('/usr/bin/docker', ['stop', workspaceID]);
  });
     
  shell.on('close', function (code) {
    ws.close();
    rimraf(workspace, function(){});
  });      
});

app.ws('/execute/:workspaceID/:args', function(ws, req) {
  const workspaceID = req.params.workspaceID
  const args = querystring.parse(req.params.args)
  const workspace = 'workspaces/' + workspaceID
  const programArgs = Object.keys(args)[0]

  const shell = pty.spawn('/usr/bin/docker', ['run', '--name', workspaceID, '-ti', '--rm', '--user', 'user', '--entrypoint', '/bin/bash', '-w', '/home/user/workspace', '-v', __dirname + '/workspaces/' + workspaceID + '/generated/src:/home/user/workspace', 'runumlrt_sandbox', '-c', '`EXECUTABLE=$(find /home/user/workspace -type f -executable) && $EXECUTABLE ' + programArgs + ' && exit`'])

  shell.on('data', (data) => {
    ws.send(data);
  });
      
  ws.on('message', (msg) => {
    shell.write(msg);
  });
  
  ws.on('close', function (code) {
    spawn('/usr/bin/docker', ['stop', workspaceID]);
  });
     
  shell.on('close', function (code) {
    ws.close();
    rimraf(workspace, function(){});
  });      
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`))
