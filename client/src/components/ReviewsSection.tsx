import { ReviewCard } from "./ReviewCard";
import { reviewsData, aggregateRating } from "@/lib/reviewsData";
import { Star } from "lucide-react";

export function ReviewsSection() {
  return (
    <section className="py-16 md:py-24 bg-[#ebe9e6]">
      <div className="container">
        {/* Section Header */}
        <div className="mb-12 md:mb-16">
          <h2 className="font-poppins font-bold text-3xl md:text-4xl text-[#0d0f13] mb-4 uppercase tracking-wide">
            Loved by Our Community
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-[#c08643] to-[#ac312d] rounded-full" />
        </div>

        {/* Rating Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 md:mb-16">
          {/* Overall Rating */}
          <div className="bg-white rounded-xl p-8 border border-[#c08643]/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl font-poppins font-bold text-[#ac312d]">
                {aggregateRating.average}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={20} className="fill-[#c08643] text-[#c08643]" />
                  ))}
                </div>
                <p className="text-sm text-[#705d48]">
                  Based on {aggregateRating.total} reviews
                </p>
              </div>
            </div>
            <p className="text-[#0d0f13] font-medium">
              Consistently excellent ratings from our valued customers
            </p>
          </div>

          {/* Rating Breakdown */}
          <div className="md:col-span-2 bg-white rounded-xl p-8 border border-[#c08643]/20">
            <h3 className="font-poppins font-semibold text-[#0d0f13] mb-6">
              Rating Breakdown
            </h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = aggregateRating.distribution[rating as keyof typeof aggregateRating.distribution];
                const percentage = (count / aggregateRating.total) * 100;
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12">
                      <span className="text-sm font-medium">{rating}</span>
                      <Star size={14} className="fill-[#c08643] text-[#c08643]" />
                    </div>
                    <div className="flex-1 h-2 bg-[#ebe9e6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#c08643] to-[#ac312d]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-[#705d48] w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviewsData.map((review, index) => (
            <div
              key={review.id}
              style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.1}s backwards` }}
            >
              <ReviewCard review={review} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 md:mt-16 text-center">
          <p className="text-[#705d48] mb-6">Read more reviews on Google Maps</p>
          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-[#ac312d] text-white font-poppins font-bold rounded-lg hover:bg-[#8f2825] hover:shadow-lg transition-all duration-200 uppercase tracking-wide"
          >
            View on Google Maps
          </a>
        </div>
      </div>
    </section>
  );
}
