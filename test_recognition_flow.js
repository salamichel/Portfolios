// Test du flux complet de reconnaissance
const { v4: uuidv4 } = require('uuid');

// Simuler ce que le batch fait
console.log('=== TEST DU FLUX DE RECONNAISSANCE ===\n');

// 1. Simuler les données retournées par recognizePeopleBatch
const batchResults = [
  {
    image_id: 'test-image-123',
    people: [
      {
        family_member_id: 'member-456',
        confidence: 0.95,
        bounding_box: { x: 10, y: 20, width: 100, height: 150 },
        member_name: 'Papa'  // Propriété supplémentaire ajoutée par le batch
      }
    ]
  }
];

console.log('1. Données retournées par recognizePeopleBatch:');
console.log(JSON.stringify(batchResults, null, 2));

// 2. Simuler ce que fait le endpoint batch-recognize lors de la sauvegarde
console.log('\n2. Données sauvegardées en DB (imagePeopleDb.create):');
for (const result of batchResults) {
  for (const person of result.people) {
    const dbRecord = {
      id: uuidv4(),
      image_id: result.image_id,
      family_member_id: person.family_member_id,
      confidence: person.confidence,
      bounding_box: person.bounding_box ? JSON.stringify(person.bounding_box) : null,
      verified: false
    };
    console.log(JSON.stringify(dbRecord, null, 2));
  }
}

// 3. Simuler ce que retourne l'API GET /images/:imageId/people
console.log('\n3. Données retournées par GET /images/:imageId/people:');
const dbPerson = {
  id: '12345',
  image_id: 'test-image-123',
  family_member_id: 'member-456',
  confidence: 0.95,
  bounding_box: '{"x":10,"y":20,"width":100,"height":150}',
  verified: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const memberData = {
  id: 'member-456',
  name: 'Papa',
  relationship: 'Père'
};

const enrichedResponse = {
  ...dbPerson,
  member: memberData
};

console.log(JSON.stringify(enrichedResponse, null, 2));

// 4. Ce que le frontend attend
console.log('\n4. Ce que le frontend affiche:');
console.log(`   Nom: ${enrichedResponse.member?.name || 'Inconnu'}`);
console.log(`   Confiance: ${Math.round(enrichedResponse.confidence * 100)}%`);
console.log(`   Vérifié: ${enrichedResponse.verified ? 'Oui' : 'Non'}`);

console.log('\n✅ Si vous voyez "Papa 95%" dans le frontend, le flux fonctionne !');
console.log('❌ Si vous voyez "Inconnu" ou rien, il y a un problème avec:');
console.log('   - La sauvegarde en DB');
console.log('   - La récupération du membre via family_member_id');
console.log('   - Le chargement des données dans le frontend');
