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

const main = async () => {
    let client;
    try {
        log.setLevel(config.get('log.level'));
        client = await getMongoClient();

        const duplicatesFile = cleanDuplicatesFile();

        let page = 1;
        let users = await fetchPageOfUsers(client, page);
        let usersWithEmail = [];

        while (users.length > 0) {
            for (const user of users) {
                if (user.email) {
                    usersWithEmail.push({
                        id: user._id.toString(),
                        email: user.email.toLowerCase(),
                        provider: user.provider,
                    });
                } else {
                    // Build fake email with providerId and provider
                    usersWithEmail.push({
                        id: user._id.toString(),
                        email: `${user.providerId}@${user.provider}.com`,
                        provider: user.provider,
                    });
                }
            }

            page++;
            log.info(`Fetching page ${page}...`);
            users = await fetchPageOfUsers(client, page);
        }

        log.info(`Sorting users...`);

        // Sort by email, followed by ensuring users with "local" provider are at the top
        usersWithEmail.sort(function compare(a, b) {
            if(a.email < b.email) { return -1; }
            if(a.email > b.email) { return 1; }

            if (a.provider === 'local') return -1;
            if (b.provider === 'local') return 1;

            return 0;
        });

        log.info(`Finding duplicates...`);
        let duplicateEmails = _.filter(
            usersWithEmail.map(el => el.email),
            (val, i, iteratee) => _.includes(iteratee, val, i + 1)
        );

        let allDuplicateEmails = usersWithEmail.filter(user => duplicateEmails.includes(user.email));

        log.info(`Writing to file...`);
        allDuplicateEmails.forEach(dup => duplicatesFile.write(`${Object.values(dup).join(',')}\n`));
        duplicatesFile.end();

    } catch(err) {
        log.error(err);
    } finally{
        await client.close();
    }
}

main().then(() => { log.info('Analysis ended.'); }).catch(err => { log.error(err); });
