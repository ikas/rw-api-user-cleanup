# RW API User cleanup scripts

Install dependencies with `yarn install`.

Analyze existing users with `yarn analysis` command.

Remove users that will not be able to login after the migration with `yarn clean` command.

Process duplicate users with `yarn duplicates` command.

**Be careful when running the clean and duplicate commands, as they apply destructive actions to your database.**

## Main flow

1. Run `yarn analysis` - this will generate 2 CSV files in the root of the project containing the results of the analysis:
  * `duplicateEmails.csv`
  * `usersWithoutEmail.csv`
2. Run `yarn clean` to clean up users
3. Move `duplicateEmails.csv` file to the `input` directory in the root of the project and run `yarn duplicates` to process duplicates.
4. Run `yarn analysis` again to confirm the results (you should now not have any duplicate users).

### Dumping the current DB

```shell
mongodump --db DATABASE --collection COLLECTION --authenticationDatabase ADMIN_DB -h HOST:PORT -u USER -p PASSWORD
```

### Restoring dump

```shell
mongorestore dumps/
```
