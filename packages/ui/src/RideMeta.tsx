import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {formatDeparture} from './time';
export default function RideMeta({ride,english}:{ride:Record<string,any>;english:boolean}){
 return <VStack gap={1}><Text style={{fontSize:'var(--lm-card-title-size)'}}><time dateTime={ride.departureTime}>{formatDeparture(ride.departureTime,ride.timeZone,english)}</time></Text><Text type="supporting">{english?`${ride.availableSeats} seats remaining`:`剩余 ${ride.availableSeats} 个座位`}</Text></VStack>;
}
