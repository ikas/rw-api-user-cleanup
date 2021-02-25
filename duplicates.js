const config = require('config');
const log = require('loglevel');
const fs = require('fs');
const neatCsv = require('neat-csv');

const getMongoClient = require('./helper');

function processCSVRows(rows) {
    let prevEmail = null;
    let prevObject = null;
    const processed = [];
    for (const row of rows) {
        if (row['Email'] === prevEmail) {
            log.info('Processing duplicate email.');
            prevObject.otherIds.push(row['Id']);
        } else {
            if (prevObject !== null) {
                processed.push(prevObject);
            }
            prevObject = {};

            log.info(`New email found: ${row['Email']}`);
            prevObject.email = row['Email'];
            prevObject.mainId = row['Id'];
            prevObject.otherIds = [];
        }

        prevEmail = row['Email'];
    }

    return processed;
}

const updateDatasets = async (client, mainId, otherId) => {
    const result = await client.db('dataset').collection('datasets').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Datasets] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Datasets] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateLayers = async (client, mainId, otherId) => {
    const result = await client.db('layer').collection('layers').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Layers] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Layers] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateWidgets = async (client, mainId, otherId) => {
    const result = await client.db('widget').collection('widgets').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Widgets] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Widgets] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateSubscriptions = async (client, mainId, otherId) => {
    const result = await client.db('subscription').collection('subscriptions').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Subscriptions] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Subscriptions] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateFWTeams = async (client, mainId, otherId) => {
    const result = await client.db('teams').collection('teams').update(
        { confirmedUsers: { $elemMatch: { id: otherId } } },
        { $set: { 'confirmedUsers.$.id': mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[FW Teams] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[FW Teams] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateVocabulary = async (client, mainId, otherId) => {
    const result = await client.db('vocabulary').collection('vocabularies').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Vocabulary] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Vocabulary] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateAreas = async (client, mainId, otherId) => {
    const result = await client.db('area').collection('areas').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Areas] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Areas] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const updateMetadata = async (client, mainId, otherId) => {
    const result = await client.db('metadata').collection('metadatas').update(
        { userId: otherId },
        { $set: { userId: mainId } },
    );

    if (result.result.ok !== 1) {
        log.error(`[Metadata] Update failed for mainId ${mainId} and otherId ${otherId}`);
    } else {
        log.info(`[Metadata] Updated ${result.result.nModified} rows for mainId ${mainId} and otherId ${otherId}`);
    }
}

const deleteUser = async (client, otherId) => {
    const result = await client.db('control-tower').collection('users').deleteOne({ _id: otherId });

    if (result.result.ok !== 1) {
        log.error(`[Users] Delete failed otherId ${otherId}`);
    } else {
        log.info(`[Users] Delete successful for otherId ${otherId}`);
    }
}

async function main() {
    let client;

    try {
        log.setLevel(config.get('log.level'));
        const csv = fs.readFileSync('input/duplicateEmails.csv');
        const rows = await neatCsv(csv);
        const processed = processCSVRows(rows);

        client = await getMongoClient();
        const initialCountUsers = await client.db('control-tower').collection('users').countDocuments();
        log.info(`Total number of users before running scripts: ${initialCountUsers}`);

        for (const user of processed) {
            log.info(`Processing user with email: ${user.email}`);
            for (const otherId of user.otherIds) {
                log.info(`Converting owner ID ${otherId} to mainId ${user.mainId}...`);
                await updateDatasets(client, user.mainId, otherId);
                await updateLayers(client, user.mainId, otherId);
                await updateWidgets(client, user.mainId, otherId);
                await updateSubscriptions(client, user.mainId, otherId);
                await updateFWTeams(client, user.mainId, otherId);
                await updateVocabulary(client, user.mainId, otherId);
                await updateAreas(client, user.mainId, otherId);
                await updateMetadata(client, user.mainId, otherId);
                await deleteUser(client, otherId)
            }
        }

        const finalUserCount = await client.db('control-tower').collection('users').countDocuments();
        log.info(`Total number of users after running scripts: ${finalUserCount}`);

    } catch(err) {
        console.error(err);
    } finally{
        await client.close();
    }
}

main()
    .then(() => console.log('Duplicates ended.'))
    .catch(err => console.error(err));
