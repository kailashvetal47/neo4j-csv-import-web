var express = require('express'),
    router = express.Router(),
    _ = require('lodash'),
    neo4j = require('neo4j'),
    CypherBuilder = require('../lib/buildCypher'),
    babyparse = require("babyparse");

// hold all data in memory to be served up for LOAD CSV
// FIXME: find a better way to persist this data
var allFiles = {};

// TODO: move route logic out into individual modules
// TODO: rename routes to something more meaningful

/** parseLoadData
 *
 * Parse load form data into datamodel mapping format
 *
 * @param formData
 * @returns {*}
 */
function parseLoadData(formData, fileData) {
  var datamodelConfig = {};


  var filenames = [];
  // get all filenames
  _.forEach(formData, function(v, k) {
    if (_.startsWith(k, 'file')) {
      filenames.push(v);
    }
  });

  var filesToImport = [];
  // filter for files selected to be imported
  _.forEach(filenames, function(file) {
    if (formData[file+'importCheck'] === 'on') {
      filesToImport.push(file);
    }
  });

  // find all nodes and relationships
  var nodes = [],
      rels = [];

  _.forEach(filesToImport, function(file) {
    if (formData[file+'typeRadios'] === 'node') {
      var node = {};
      node['filename'] = file;
      node['labels']  = [];
      node['properties']  = [];

      _.forEach(fileData[file]['meta']['fields'], function(field) {
        var properties = {};
        properties['headerKey'] = field;
        properties['neoKey'] = field;
        properties['dataType'] = 'string';
        properties['primaryKey'] = false;
        properties['skip'] = false;

        node['properties'].push(properties);
      });

      nodes.push(node);
    } else if (formData[file+'typeRadios'] === 'relationship') {
      var rel = {};
      rel['filename'] = file;
      rels.push(rel);
    }
  });

  datamodelConfig['nodes'] = nodes;
  datamodelConfig['relationships'] = rels;


  return datamodelConfig;
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/datamodel', function(req, res, next) {
  var fileData = req.session.fileData,
      configData = req.session.configData;

  var context = {};
  context = fileData; // array of file names
  context['config'] = configData;
  console.dir(context);
  res.render('datamodel', context);
});

router.post('/datamodel', function(req, res, next) {
  var configData = req.body;
  //var formData = req.body,
  //    configData = req.session.configData,
  //    fileData = req.session.fileData,
  //    nodesConfig = [];
  //
  //
  //console.dir(formData);
  //console.dir(configData);
  //console.dir(fileData);
  //
  //var labelsArray = ["Node"]; // FIXME: temporary placeholder for labels
  //
  //_.forEach(fileData.files, function(filename) {
  //  var nodeConfig = _.filter(configData.nodes, {'filename': filename})[0];
  //  console.dir(nodeConfig);
  //  // create labels array, add labels: ["NODE"]
  //  // get all fields for this filename
  //  // for each field
  //  // if field is included
  //  // create obj
  //  // headerKey, neoKey, dataType, index, primaryKey, foreignKey
  //  // append to properties array
  //  // properties: [{headerKey, neoKey, dataType, index, primaryKey, foreignKey}]
  //
  //  var fields = fileData[filename]['meta']['fields'],
  //      properties = [];
  //
  //
  //  _.forEach(fields, function(field, i) {
  //    if (formData[filename+'-'+field+'-include'] === 'on') {
  //      var propertyObj = {};
  //      propertyObj['headerKey'] = field;
  //      propertyObj['neoKey'] = formData[filename + '-' + field + '-rename'] || field;
  //
  //      propertyObj['dataType'] = 'string'; // FIXME: get data type
  //      if (formData[filename + '-' + field + '-index'] === 'on') {
  //        propertyObj['index'] = true;
  //      } else {
  //        propertyObj['index'] = false;
  //      }
  //
  //      if (formData[filename + '-' + field + '-pk'] === "on") {
  //        propertyObj['primaryKey'] = true;
  //      } else {
  //        propertyObj['primaryKey'] = false;
  //      }
  //
  //      propertyObj['foreignKey'] = false; // FIXME: not implemented
  //
  //      properties.push(propertyObj);
  //    }
  //
  //  });
  //
  //  var strippedFilename = filename.split('.').join(""); // FIXME: better consistency with naming here
  //  nodeConfig['labels'] = [formData[strippedFilename+'LabelInput']];
  //  nodeConfig['properties'] = properties;
  //  nodesConfig.push(nodeConfig);
  //
  //
  //});
  //configData.nodes = nodesConfig;
  req.session.configData = configData;
  req.session.save();
  console.dir(configData);

  res.send("OK");
  //res.redirect('/import');

});

router.get('/files/:uidparam/:filename', function(req, res, next) {
  var filename = req.params.filename,
      uidparam = req.params.uidparam;

  var data = allFiles[uidparam][filename]['data'];
  //var data = req.session.fileData[filename]['data'];

  res.set('Content-Type', 'application/csv');
  res.send(babyparse.unparse(data));
});

router.get('/import', function(req, res, next) {
  var protocol = 'http://'; // other protocols?
  var cypherBuilder = new CypherBuilder(req.session.fileData, req.session.configData, protocol +req.headers.host, req.sessionID);
  var cypher = cypherBuilder.buildCypher();
  var csvCypher = cypherBuilder.buildCSVCypher();
  //var cypher = cypherBuilder.getTestCypher();

  // get filedata and config data from session
  // instantiate CypherBuilder instance and generate cypher
  // pass cypher in the context object
  // populate textarea with cypher in template
  // add js event handler to call ajax method to connect / run against Neo4j instance
  res.render('import', {cypher: cypher, loadCSVCypher: csvCypher});
});

router.post('/importNeo4jInstance', function(req, res, next) {
  // get connection vars from req.body
  // connect to Neo4j instance
  // get filedata and config data from session
  // instaantiate cypherBuilder instance and generate cypher
  // execute query against neo4j
  // return results
  var username = req.body.neo4jUser,
      password = req.body.neo4jPassword,
      neo4jURL = req.body.neo4jURL;
  var connConfig = {
    "url": neo4jURL
  };

  if (username.length > 0 && password.length > 0) {
    connConfig['auth'] = {
      "username": username,
      "password": password
    };
  }

  var db = new neo4j.GraphDatabase(connConfig);

  var cypherBuilder = new CypherBuilder(req.session.fileData, req.session.configData);

  var statements = cypherBuilder.buildCSVCypher().split(";");
  //var cypher = cypherBuilder.getTestCypher(); // FIXME: don't use test cypher
  //console.log(cypher);

  var queryObjs = [];

  _.forEach(statements, function(cypher) {
    console.log(cypher);
    var obj = {};
    obj['query'] = cypher;
    if (cypher.length > 1) {
      queryObjs.push(obj);
      console.log(queryObjs);
    }
  });

  db.cypher({queries: queryObjs}, function(err, results) {
    console.log(results);
    if (err) {
      console.log(err);
      //throw err;
      res.send(err);
      //return next(err);
    } else {
      console.log(results);
      res.send(results);
    }

  });

});


router.get('/load', function(req, res, next) {
  res.render('load', {title: 'Load'});
});

router.post('/load', function(req, res, next) {
  req.session.fileData = req.body;
  req.session.save();
  allFiles[req.sessionID] = req.body;
  //allFiles = req.body;
  console.dir(req.session);
  //console.log(req.session.fileData);

});

router.get('/load2', function(req, res, next) {
  var fileData = req.session.fileData;
  var context = {};
  context['files'] = fileData.files;
  res.render('load2', context);

});

router.post('/load2', function(req, res, next) {
  var formData = req.body;
  console.dir(formData);

  req.session.configData = parseLoadData(formData, req.session.fileData);
  req.session.save();

  res.redirect('/datamodel');

});

router.get('/preview/:filename', function(req, res, next) {
  var filename = req.params.filename;
  //console.log(req.session);
  // TODO: process form data into something easier to work with
  var previewData = req.session.fileData[filename];
  previewData['filename'] = filename;
  res.render('preview', previewData)
});

module.exports = router;
