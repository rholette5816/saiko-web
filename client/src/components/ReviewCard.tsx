import { Review } from "@/lib/reviewsData";
import { Star, CheckCircle } from "lucide-react";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-[#c08643]/20 hover:shadow-lg hover:border-[#c08643]/40 transition-all duration-300">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={i < review.rating ? "fill-[#c08643] text-[#c08643]" : "text-[#ebe9e6]"}
              />
            ))}
          </div>
          {review.verified && <CheckCircle size={16} className="text-green-500" />}
        </div>
        <span className="text-xs text-[#705d48]">{review.date}</span>
      </div>

      <h4 className="font-poppins font-semibold text-[#0d0f13] mb-2">{review.author}</h4>
      <p className="text-sm text-[#705d48] leading-relaxed">{review.text}</p>
    </div>
  );
}
