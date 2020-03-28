# metasphere - COVID-19 Research - backend

- [GraphQL Server](./graph)
- [Article Server](./aws)

## Scenarios

### Registering an article

1. A `maintainer` finds a new `article`.
2. The `maintainer` posts the `article` to the `article server`.
3. The `article server` stores the `article` in the `article database`.
4. The `article server` triggers an `article preprocessing` with the `article`.
5. The `article server` notifies the `maintainer` of success.

### Retrieving an article by paper ID

1. A `user` somehow identifies the `article ID` of an `article` of interest.
2. The `user` asks the `article server` for an `article` of the `article ID`.
3. The `article server` finds an `article` of the `article ID` in the `article database`.
4. The `artcile server` returns the found `article` to the `user`.