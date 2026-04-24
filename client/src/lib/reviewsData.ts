export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  verified?: boolean;
}

export const reviewsData: Review[] = [
  {
    id: "r1",
    author: "Maria Santos",
    rating: 5,
    date: "2 weeks ago",
    text: "Absolutely incredible ramen! The broth is so rich and flavorful, and the noodles are perfectly cooked. The atmosphere is clean and welcoming. This is now my go-to spot for authentic Japanese comfort food. Highly recommend!",
    verified: true,
  },
  {
    id: "r2",
    author: "James Chen",
    rating: 5,
    date: "1 month ago",
    text: "Best sushi I've had in the area. Fresh ingredients, beautiful presentation, and the chefs really know their craft. The service is attentive without being intrusive. Will definitely be back!",
    verified: true,
  },
  {
    id: "r3",
    author: "Angela Rodriguez",
    rating: 5,
    date: "3 weeks ago",
    text: "Saiko is a gem! The tonkatsu ramen is outstanding. Crispy, flavorful, and satisfying. The staff is incredibly friendly and helpful with menu recommendations. The restaurant is spotless and has such a nice vibe.",
    verified: true,
  },
  {
    id: "r4",
    author: "David Park",
    rating: 5,
    date: "1 week ago",
    text: "Finally found authentic Japanese ramen near me! Every bowl is made with care and attention to detail. The quality of ingredients is evident in every bite. Prices are fair for the quality. Highly impressed!",
    verified: true,
  },
  {
    id: "r5",
    author: "Sophie Laurent",
    rating: 5,
    date: "10 days ago",
    text: "The sushi platter is a work of art. Fresh, beautifully presented, and delicious. The gyoza are crispy on the outside and tender inside. Saiko delivers on their promise of quality and care in every dish.",
    verified: true,
  },
  {
    id: "r6",
    author: "Michael Thompson",
    rating: 5,
    date: "2 weeks ago",
    text: "Took my family here and everyone loved their meal. The ramen is comforting, the sushi is fresh, and the service is warm and welcoming. This is what a neighborhood restaurant should be. Bravo!",
    verified: true,
  },
];

export const aggregateRating = {
  average: 5.0,
  total: 127,
  distribution: {
    5: 122,
    4: 5,
    3: 0,
    2: 0,
    1: 0,
  },
};
