const config = require('config');
const log = require('loglevel');
const MongoClient = require('mongodb').MongoClient;

module.exports = async function getMongoClient() {
    log.info('Establishing connection with MongoDB...');
    return await MongoClient.connect(config.get('mongo.uri'), {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
}
