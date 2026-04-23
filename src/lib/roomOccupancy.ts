type ActiveOccupancyLike = {
  status: string;
  monthlyRent: number;
};

type RoomWithOccupancies = {
  status: string;
  monthlyRent: number;
  occupancies?: ActiveOccupancyLike[];
};

export function getActiveOccupancy(room: RoomWithOccupancies) {
  return room.occupancies?.find((occupancy) => occupancy.status === "ACTIVE") ?? null;
}

export function isRoomOccupied(room: RoomWithOccupancies) {
  return getActiveOccupancy(room) !== null;
}

export function getDisplayRoomStatus(room: RoomWithOccupancies) {
  if (isRoomOccupied(room)) return "OCCUPIED";
  return room.status === "OCCUPIED" ? "VACANT" : room.status;
}

export function summarizeRooms(rooms: RoomWithOccupancies[]) {
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(isRoomOccupied).length;
  const vacantRooms = totalRooms - occupiedRooms;
  const monthlyIncome = rooms.reduce((sum, room) => {
    const activeOccupancy = getActiveOccupancy(room);
    return sum + (activeOccupancy?.monthlyRent ?? 0);
  }, 0);

  return {
    totalRooms,
    occupiedRooms,
    vacantRooms,
    monthlyIncome,
  };
}
