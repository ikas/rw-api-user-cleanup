# RW API User cleanup scripts

## Dumping the current DB

```shell
mongodump --db DATABASE --collection COLLECTION --authenticationDatabase ADMIN_DB -h HOST:PORT -u USER -p PASSWORD
```

## Restoring dump

```shell
mongorestore dumps/
```
