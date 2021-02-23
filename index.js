const MongoClient = require('mongodb').MongoClient;
const config = require('config');
const log = require('loglevel');

async function main() {
    let client;
    try{
        log.setLevel(config.get('log.level'));
        log.info('Establishing connection with MongoDB...');
        client = await MongoClient.connect(config.get('mongo.uri'), {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const result = await client.db('control-tower').collection('users').countDocuments();
        console.log(result);
    } catch(err) {
        console.error(err);
    } finally{
        await client.close();
    }
}

main().then(() => console.log('script ended')).catch(err => console.error(err));
