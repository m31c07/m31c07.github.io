class CreatureDataModule {
    constructor() {
        // Creature data - all creature info is contained within each array element
        this.creatures = [
            { 
                id: 1, 
                name: "Fire Fox", 
                level: 5,
                hp: 100,
                maxHp: 100,
                imagePath: 'img/creatures/fox1.png',
                image: new Image(),
                absorption: {
                    fire: { 2: 0.75, 3: 0.5, 4: 0.25 }
                }
            },
            { 
                id: 2, 
                name: "Ice Wolf", 
                level: 7,
                hp: 100,
                maxHp: 100,
                imagePath: 'img/creatures/wolf1.png',
                image: new Image(),
                absorption: {
                    ice: { 1: 1, 2: 1, 3: 1 }
                }
            }
        ];
        
        // Load creature images using a universal approach
        this.creatures.forEach(creature => {
            creature.image.src = creature.imagePath;
        });
    }
    
    // Get all creatures
    getAllCreatures() {
        return this.creatures;
    }
    
    // Get creature by ID
    getCreatureById(id) {
        return this.creatures.find(creature => creature.id === id);
    }
    
    // Get creature by index
    getCreatureByIndex(index) {
        return this.creatures[index];
    }
    
    // Get number of creatures
    getCreatureCount() {
        return this.creatures.length;
    }
}