// Word A = Undercover's word, Word B = Civilians' word.
export const DEFAULT_PAIRS = [
  ['Coffee', 'Tea'], ['Dog', 'Cat'], ['Sun', 'Moon'], ['Ocean', 'River'], ['Pizza', 'Burger'],
  ['Book', 'Magazine'], ['Train', 'Bus'], ['Mountain', 'Hill'], ['Chair', 'Sofa'], ['Apple', 'Pear'],
  ['Rain', 'Snow'], ['Hotel', 'Hostel'], ['Cake', 'Cookie'], ['Nurse', 'Doctor'], ['Laptop', 'Tablet'],
  ['Museum', 'Library'], ['Sunrise', 'Sunset'], ['Forest', 'Jungle'], ['Guitar', 'Violin'], ['Swimming', 'Surfing'],
].map(([a, b]) => ({ a, b, mrWhite: true }));
