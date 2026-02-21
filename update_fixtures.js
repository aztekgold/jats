const fs = require('fs');
const SCHEMA_URL = 'https://raw.githubusercontent.com/aztekgold/jats/main/schema.json';

const files = [
    'spec/fixtures/invalid/jats_bad_type.table.json',
    'spec/fixtures/invalid/jats_missing_version.table.json',
    'spec/fixtures/valid/jats_full_1.0.table.json',
    'spec/fixtures/valid/jats_minimal_1.0.table.json'
];

files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data['$schema']) {
        const newData = { '$schema': SCHEMA_URL, ...data };
        fs.writeFileSync(file, JSON.stringify(newData, null, 4));
    }
});
