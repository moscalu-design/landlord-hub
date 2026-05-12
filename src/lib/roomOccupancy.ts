type ActiveOccupancyLike = {
  status: string;
  monthlyRent: number;
};

type RoomWithOccupancies = {
  status: string;
  monthlyRent: number;
  isDefaultWholePropertyRoom?: boolean;
  occupancies?: ActiveOccupancyLike[];
};

// Default whole-property rooms are hidden from regular room lists / counts.
export function isVisibleRoom(room: RoomWithOccupancies) {
  return room.isDefaultWholePropertyRoom !== true;
}

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

// Income counts every room (including hidden whole-property units, which carry
// the active tenancy's rent). Room counts exclude hidden whole-property rooms
// so users don't see a phantom unit in the UI.
export function summarizeRooms(rooms: RoomWithOccupancies[]) {
  const visibleRooms = rooms.filter(isVisibleRoom);
  const totalRooms = visibleRooms.length;
  const occupiedRooms = visibleRooms.filter(isRoomOccupied).length;
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
