import { formatDeparture } from "./time";
export default function RideMeta({
  ride,
  english,
}: {
  ride: Record<string, any>;
  english: boolean;
}) {
  return (
    <>
      <time dateTime={ride.departureTime}>
        {formatDeparture(ride.departureTime, ride.timeZone, english)}
      </time>
      <small>
        {english
          ? `${ride.availableSeats} seats remaining`
          : `剩余 ${ride.availableSeats} 个座位`}
      </small>
    </>
  );
}
