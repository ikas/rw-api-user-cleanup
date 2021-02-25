const config = require('config');
const log = require('loglevel');

const getMongoClient = require('./helper');

const deleteWithGoogleProvider = async (client) => {
    log.info('Preparing to delete users with provider "google-plus"...');
    const countRes = await client
        .db('control-tower')
        .collection('users')
        .deleteMany({ provider: 'google-plus' });
    log.info(`Deleted ${countRes.result.n} users with provider "google-plus"`);
};

const deletedWithLocalProvider = async (client) => {
    log.info('Preparing to delete users with provider "local" without email...');
    const countRes = await client
        .db('control-tower')
        .collection('users')
        .deleteMany({ provider: 'local', email: { $eq: null } });
    log.info(`Deleted ${countRes.result.n} users with provider "local" without email`);
};

async function main() {
    let client;
    try {
        log.setLevel(config.get('log.level'));
        client = await getMongoClient();

        const initialCountUsers = await client.db('control-tower').collection('users').countDocuments();
        log.info(`Total number of users before running scripts: ${initialCountUsers}`);

        await deleteWithGoogleProvider(client);
        await deletedWithLocalProvider(client);
    } catch(err) {
        console.error(err);
    } finally{
        await client.close();
    }
}

main()
    .then(() => console.log('Clean ended.'))
    .catch(err => console.error(err));
