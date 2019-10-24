This repository has been forked from https://github.com/Squidex/squidex a Headless CMS of Squidex. 
Within the master branch of this repository, sorting is enabled via drag&drop of entities, actually contents via an increasing order no field stored within database. Additionally, both api and cms UI pages are returning ordered data by default. 

Caution:
When you switch this fork, as you have no "orderno" field in current mongodb, it must be seeded using this mongodb code:
```
db.collection.aggregate([
  {
  "on": { "$toLong" : "$ct"}
  }
])
```

**Features of this fork:**
- Content sorting
- Left menu changes based on scheme edit claim: if user has no rights to edit schemes, 1st level of left menu is directly hidden
- Theme changed to materialish design
