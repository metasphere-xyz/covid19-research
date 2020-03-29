# Database

DynamoDB is used to store metasphere data.

## Scenarios

### Finds an article of a given hash

- `Partition` = `article:{hash}`

### Finds an article with a given tag

- `Partition` = `tag:{tag}`
- `Sort` = `{hash}`