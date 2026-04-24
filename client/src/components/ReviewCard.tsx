import { Review } from "@/lib/reviewsData";
import { Star, CheckCircle } from "lucide-react";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-orange-100 hover:shadow-lg transition-shadow duration-300">
      {/* Header with rating and verification */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Stars */}
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={`${
                  i < review.rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          {review.verified && (
            <CheckCircle size={16} className="text-green-500" />
          )}
        </div>
        <span className="text-xs text-muted-foreground">{review.date}</span>
      </div>

      {/* Author */}
      <h4 className="font-poppins font-semibold text-foreground mb-2">
        {review.author}
      </h4>

      {/* Review text */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {review.text}
      </p>
    </div>
  );
}
