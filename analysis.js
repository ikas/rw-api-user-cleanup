const axios = require('axios');
const config = require('config');
const log = require('loglevel');
const fs = require('fs');
const _ = require('lodash');

const getMongoClient = require('./helper');

const cleanDuplicatesFile = () => {
    const duplicatesFile = fs.createWriteStream('duplicateEmails.csv');
    fs.truncateSync('duplicateEmails.csv', 0);
    duplicatesFile.write('Id,Email,Provider,Datasets,Layers,Widgets,Dashboards,Subscriptions,FW Teams,Vocabulary,Areas,Metadata\n');
    return duplicatesFile;
};

const cleanUsersWithNoEmailFile = () => {
    const noEmailFile = fs.createWriteStream('usersWithoutEmail.csv');
    fs.truncateSync('usersWithoutEmail.csv', 0);
    noEmailFile.write('Id,Provider\n');
    return noEmailFile;
};

const fetchPageOfUsers = async (client, page) => {
    const limit = 200;
    const skip = (page - 1) * limit;
    const users = [];

    const usersPage = await client
        .db('control-tower')
        .collection('users')
        .find()
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit);

    await usersPage.forEach(doc => users.push(doc));
    return users;
}

const countDatasets = async (client, id) => {
    return client.db('dataset').collection('datasets').countDocuments({ userId: id });
}

const countLayers = async (client, id) => {
    return client.db('layer').collection('layers').countDocuments({ userId: id });
}

const countWidgets = async (client, id) => {
    return client.db('widget').collection('widgets').countDocuments({ userId: id });
}

const countSubscriptions = async (client, id) => {
    return client.db('subscription').collection('subscriptions').countDocuments({ userId: id });
}

const countFWTeams = async (client, id) => {
    return client.db('teams').collection('teams').countDocuments({ confirmedUsers: { $elemMatch: { id } } });
}

const countVocabulary = async (client, id) => {
    return client.db('vocabulary').collection('vocabularies').countDocuments({ userId: id });
}

const countAreas = async (client, id) => {
    return client.db('area').collection('areas').countDocuments({ userId: id });
}

const countMetadata = async (client, id) => {
    return client.db('metadata').collection('metadatas').countDocuments({ userId: id });
}

const countDashboards = async (id) => {
    const res = await axios.get(
        `${config.get('api.url')}/v1/dashboard?user=${id}`,
        { headers: { Authorization: `Bearer ${config.get('api.token')}` }}
    );

    return res.data.meta['total-items'];
}

const main = async () => {
    let client;
    try {
        log.setLevel(config.get('log.level'));
        client = await getMongoClient();

        const duplicatesFile = cleanDuplicatesFile();
        const noEmailFile = cleanUsersWithNoEmailFile();

        let page = 1;
        let users = await fetchPageOfUsers(client, page);
        let usersWithEmail = [];

        while (users.length > 0) {
            // Write users with no email directly to file
            users.filter(user => !user.email).forEach(user => { noEmailFile.write(`${user._id.toString()},${user.provider}\n`); });

            usersWithEmail = usersWithEmail.concat(users.filter(user => !!user.email).map(user => ({
                id: user._id.toString(),
                email: user.email.toLowerCase(),
                provider: user.provider,
            })));

            page++;
            log.info(`Fetching page ${page}...`);
            users = await fetchPageOfUsers(client, page);
        }

        noEmailFile.end();

        // Sort by email, followed by ensuring users with "local" provider are at the top
        usersWithEmail.sort(function compare(a, b) {
            if(a.email < b.email) { return -1; }
            if(a.email > b.email) { return 1; }

            if (a.provider === 'local') return -1;
            if (b.provider === 'local') return 1;

            return 0;
        });

        let duplicateEmails = _.filter(
            usersWithEmail.map(el => el.email),
            (val, i, iteratee) => _.includes(iteratee, val, i + 1)
        );

        let allDuplicateEmails = usersWithEmail.filter(user => duplicateEmails.includes(user.email));
        let it = 1;
        for (let user of allDuplicateEmails) {
            user.datasets = await countDatasets(client, user.id);
            user.layers = await countLayers(client, user.id)
            user.widgets = await countWidgets(client, user.id);
            user.dashboards = await countDashboards(user.id);
            user.subscriptions = await countSubscriptions(client, user.id);
            user.fwTeams = await countFWTeams(client, user.id);
            user.vocabularies = await countVocabulary(client, user.id);
            user.areas = await countAreas(client, user.id);
            user.metadata = await countMetadata(client, user.id);

            log.info(`Processed content for duplicate user ${it}/${allDuplicateEmails.length}`);
            it++;
        }

        allDuplicateEmails.forEach(dup => duplicatesFile.write(`${Object.values(dup).join(',')}\n`));
        duplicatesFile.end();

    } catch(err) {
        log.error(err);
    } finally{
        await client.close();
    }
}

main().then(() => { log.info('Analysis ended.'); }).catch(err => { log.error(err); });
