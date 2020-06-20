// Helper functions for the WorldCreator - stuff that may be useful outside of world creation as well
define([
	'ash',
    'game/vos/ResourcesVO',
	'worldcreator/WorldCreatorRandom',
	'worldcreator/WorldCreatorConstants',
	'game/constants/LevelConstants',
	'game/constants/PositionConstants',
	'game/constants/SectorConstants',
	'game/constants/WorldConstants',
], function (Ash, ResourcesVO, WorldCreatorRandom, WorldCreatorConstants, LevelConstants, PositionConstants, SectorConstants, WorldConstants) {

    var WorldCreatorHelper = {
        
        camplessLevelOrdinals: {},
        hardLevelOrdinals: {},
        
        addCriticalPath: function (worldVO, pathStartPos, pathEndPos, pathType) {
            var path = WorldCreatorRandom.findPath(worldVO, pathStartPos, pathEndPos);
            for (var j = 0; j < path.length; j++) {
                var levelVO = worldVO.getLevel(path[j].level);
                levelVO.getSector(path[j].sectorX, path[j].sectorY).addToCriticalPath(pathType);
            }
        },
        
        getClosestPair: function (sectors1, sectors2, skip) {
            skip = skip || 0;
            var result = [null, null];
            var resultDist = 9999;
            var pairs = [];
            for (var i = 0; i < sectors1.length; i++) {
                for (var j = 0; j < sectors2.length; j++) {
                    pairs.push([sectors1[i], sectors2[j]]);
                }
            }
            pairs.sort(function (a, b) {
                return PositionConstants.getDistanceTo(a[0].position, a[1].position) - PositionConstants.getDistanceTo(b[0].position, b[1].position);
            });
            return pairs[skip];
        },
        
        getClosestSector: function (sectors, pos, skip) {
            skip = skip || 0;
            if (skip >= sectors.length) skip = sectors.length - 1;
            var sorted = sectors.concat();
            sorted.sort(function (a, b) {
                return PositionConstants.getDistanceTo(a.position, pos) - PositionConstants.getDistanceTo(b.position, pos);
            });
            return sorted[skip];
        },
        
        getClosestPosition: function (positions, pos) {
            var result = null;
            var resultDist = 0;
            for (var i = 0; i < positions.length; i++) {
                var dist = PositionConstants.getDistanceTo(positions[i], pos);
                if (!result || dist < resultDist) {
                    result = positions[i];
                    resultDist = dist;
                }
            }
            return result;
        },
        
        getDistanceToCamp: function (worldVO, levelVO, sector) {
            if (sector.distanceToCamp >= 0) return sector.distanceToCamp;
            var result = 9999;
            for (var s = 0; s < levelVO.campPositions.length; s++) {
                var campPos = levelVO.campPositions[s];
                var path = WorldCreatorRandom.findPath(worldVO, sector.position, campPos, false, true);
                if (path && path.length >= 0) {
                    var dist = path.length;
                    result = Math.min(result, dist);
                }
            }
            sector.distanceToCamp = result;
            return result;
        },
        
        getQuickDistanceToCamp: function (levelVO, sector) {
            var result = 9999;
            for (var s = 0; s < levelVO.campPositions.length; s++) {
                var campPos = levelVO.campPositions[s];
                var dist = PositionConstants.getDistanceTo(sector.position, campPos);
                result = Math.min(result, dist);
            }
            return result;
        },
        
        sortSectorsByPathLenTo: function (worldVO, sector) {
            return function (a, b) {
                var patha = WorldCreatorRandom.findPath(worldVO, sector.position, a.position);
                var pathb = WorldCreatorRandom.findPath(worldVO, sector.position, b.position);
                return patha.length - pathb.length;
            };
        },
        
        sortSectorsByDistanceTo: function (position) {
            return function (a, b) {
                var dista = PositionConstants.getDistanceTo(position, a.position);
                var distb = PositionConstants.getDistanceTo(position, b.position);
                return dista - distb;
            };
        },
        
        getVornoiPoints: function (seed, worldVO, levelVO) {
            var level = levelVO.level;
            var points = [];
            var addPoint = function (position, zone, minDistance) {
                if (minDistance) {
                    for (var i = 0; i < points.length; i++) {
                        if (PositionConstants.getDistanceTo(points[i].position, position) <= minDistance) return false;
                    }
                }
                points.push({ position: position, zone: zone, sectors: [] });
                return true;
            };
            
            // camp
            var campMiddle = PositionConstants.getMiddlePoint(levelVO.campPositions);
            addPoint(campMiddle, WorldConstants.ZONE_POI_TEMP);
            
            // two sectors furthest away from the camp (but not next to each other)
            var sectorsByDistance = levelVO.sectors.slice(0).sort(WorldCreatorHelper.sortSectorsByDistanceTo(campMiddle));
            addPoint(sectorsByDistance[sectorsByDistance.length - 1].position, WorldConstants.ZONE_EXTRA_CAMPABLE);
            var i = 1;
            while (i < sectorsByDistance.length) {
                i++;
                var added = addPoint(sectorsByDistance[sectorsByDistance.length - i].position, WorldConstants.ZONE_POI_TEMP, 8);
                if (added) break;
            }
            
            // randomish positions in 8 cardinal directions from camp
            var directions = PositionConstants.getLevelDirections();
            for (var i in directions) {
                var direction = directions[i];
                var pointDist = 7 + WorldCreatorRandom.randomInt(10101 + seed % 11 * 182 + i*549 + level * 28, 0, 7);
                var pointPos = PositionConstants.getPositionOnPath(campMiddle, direction, pointDist);
                if (levelVO.containsPosition(pointPos)) {
                    addPoint(pointPos, WorldConstants.ZONE_POI_TEMP, 6);
                }
            }
            
            return points;
        },
        
        getBorderSectorsForZone: function (levelVO, zone, includeAllPairs) {
            var result = [];
            var directions = PositionConstants.getLevelDirections();
            for (var i = 0; i < levelVO.sectors.length; i++) {
                var sector = levelVO.sectors[i];
                if (sector.zone == zone) continue;
                var neighbours = levelVO.getNeighbours(sector.position.sectorX, sector.position.sectorY);
                for (var d in directions) {
                    var direction = directions[d];
                    var neighbour = neighbours[direction];
                    if (neighbour && neighbour.zone == zone) {
                        result.push({ sector: sector, neighbour: neighbour });
                        if (!includeAllPairs) break;
                    }
                }
            }
            return result;
        },
        
        getFeaturesSurrounding: function (worldVO, levelVO, pos) {
            var result = [];
            var candidates = PositionConstants.getAllPositionsInArea(pos, 5);
            for (var i = 0; i < candidates.length; i++) {
                var position = candidates[i];
                var features = worldVO.getFeaturesByPos(position);
                for (var j = 0; j < features.length; j++) {
                    var feature = features[j];
                    if (result.indexOf(feature) >= 0) {
                        continue;
                    }
                    result.push(feature);
                }
            }
            return result;
        },
		
		getBottomLevel: function (seed) {
            switch (seed % 5) {
                case 0: return 0;
                case 1: return 1;
                case 2: return -1;
                case 3: return 1;
                case 4: return 0;
            }
		},
		
		getHighestLevel: function (seed) {
            switch (seed % 5) {
                case 0: return 25;
                case 1: return 26;
                case 2: return 25;
                case 3: return 26;
                case 4: return 24;
            }
		},
		
		getLevelOrdinal: function(seed, level) {
			if (level > 13) {
                var bottomLevel = this.getBottomLevel(seed);
                var bottomLevelOrdinal = this.getLevelOrdinal(seed, bottomLevel);
                return bottomLevelOrdinal + (level - 13);
			} else {
                return -level + 14;
            }
		},
        
        getLevelForOrdinal: function (seed, levelOrdinal) {
            var bottomLevel = this.getBottomLevel(seed);
            var bottomLevelOrdinal = this.getLevelOrdinal(seed, bottomLevel);
            if (levelOrdinal <= bottomLevelOrdinal)
                return 13 - (levelOrdinal - 1);
            else
                return 13 + (levelOrdinal - bottomLevelOrdinal);
        },
		
		getCampOrdinal: function (seed, level) {
            var camplessLevelOrdinals = this.getCamplessLevelOrdinals(seed);
			var levelOrdinal = this.getLevelOrdinal(seed, level);
			var ordinal = 0;
			for (var i = 1; i <= levelOrdinal; i++) {
				if (camplessLevelOrdinals.indexOf(i) < 0) ordinal++;
			}
			return ordinal;
		},
        
        getLevelsForCamp: function (seed, campOrdinal) {
            var result = [];
            var mainLevelOrdinal = this.getLevelOrdinalForCampOrdinal(seed, campOrdinal);
            var mainLevel = this.getLevelForOrdinal(seed, mainLevelOrdinal);
            result.push(mainLevel);
            
            var camplessLevelOrdinals = this.getCamplessLevelOrdinals(seed);
            for (var i = 0; i < camplessLevelOrdinals.length; i++) {
                var l = this.getLevelForOrdinal(seed, camplessLevelOrdinals[i]);
                var co = this.getCampOrdinal(seed, l);
                if (co == campOrdinal) {
                    result.push(l);
                }
            }
            
            return result;
        },
        
        getNumSectorsForCamp: function (seed, campOrdinal) {
            var result = 0;
            var levels = WorldCreatorHelper.getLevelsForCamp(seed, campOrdinal);
            for (var i = 0; i < levels.length; i++) {
                var level = levels[i];
                var isSmallLevel = WorldCreatorHelper.isSmallLevel(seed, level);
                var numSectors = WorldCreatorConstants.getNumSectors(campOrdinal, isSmallLevel);
                result += numSectors;
            }
            return result;
        },
        
        getNumSectorsForLevelStage: function (worldVO, levelVO, stage) {
            var stages = worldVO.getStages(levelVO.level);
            for (var i = 0; i < stages.length; i++) {
                if (stages[i].stage == stage) {
                    return levelVO.numSectors / stages.length;
                }
            }
            return 0;
        },
        
        getLevelOrdinalForCampOrdinal: function (seed, campOrdinal) {
            // this assumes camplessLevelOrdinals are sorted from smallest to biggest
            var levelOrdinal = campOrdinal;
            var camplessLevelOrdinals = this.getCamplessLevelOrdinals(seed);
            for (var i = 0; i < camplessLevelOrdinals.length; i++) {
                if (camplessLevelOrdinals[i] <= levelOrdinal) {
                    levelOrdinal++;
                }
            }
            return levelOrdinal;
        },
        
        isCampableLevel: function (seed, level) {
            var camplessLevelOrdinals = this.getCamplessLevelOrdinals(seed);
            var levelOrdinal = this.getLevelOrdinal(seed, level);
            var campOrdinal = this.getCampOrdinal(seed, level);
            return camplessLevelOrdinals.indexOf(levelOrdinal) < 0 && campOrdinal <= WorldConstants.CAMP_ORDINAL_LIMIT;
        },
        
        isHardLevel: function (seed, level) {
            var hardLevelOrdinals = this.getHardLevelOrdinals(seed);
            var levelOrdinal = this.getLevelOrdinal(seed, level);
            return hardLevelOrdinals.includes(levelOrdinal);
        },
        
        isSmallLevel: function (seed, level) {
            var isCampableLevel = this.isCampableLevel(seed, level);
			var topLevel = this.getHighestLevel(seed);
			var bottomLevel = this.getBottomLevel(seed);
            return !isCampableLevel && level !== bottomLevel && level < topLevel - 1;
        },
        
        getNotCampableReason: function (seed, level) {
            if (this.isCampableLevel(seed, level)) return null;
			var bottomLevel = this.getBottomLevel(seed);
            
            if (level === 14) return LevelConstants.UNCAMPABLE_LEVEL_TYPE_RADIATION;
            if (level == bottomLevel) return LevelConstants.UNCAMPABLE_LEVEL_TYPE_SUPERSTITION;
            
            var campOrdinal = this.getCampOrdinal(seed, level);
            if (campOrdinal > WorldConstants.CAMP_ORDINAL_LIMIT)
                return LevelConstants.UNCAMPABLE_LEVEL_TYPE_ORDINAL_LIMIT;
            
            var levelOrdinal = this.getLevelOrdinal(seed, level);
            var rand = WorldCreatorRandom.random(seed % 4 + level + level * 8 + 88);
            if (rand < 0.33 && levelOrdinal >= WorldCreatorConstants.MIN_LEVEL_ORDINAL_HAZARD_RADIATION)
                return LevelConstants.UNCAMPABLE_LEVEL_TYPE_RADIATION;
            if (rand < 0.66 && levelOrdinal >= WorldCreatorConstants.MIN_LEVEL_ORDINAL_HAZARD_POISON)
                return LevelConstants.UNCAMPABLE_LEVEL_TYPE_POLLUTION;
            return LevelConstants.UNCAMPABLE_LEVEL_TYPE_SUPERSTITION;
        },
		
		getCamplessLevelOrdinals: function (seed) {
            if (!this.camplessLevelOrdinals[seed]) {
                var camplessLevelOrdinals = [];

                switch (seed % 5) {
                    case 0:
                        camplessLevelOrdinals.push(25);
                        camplessLevelOrdinals.push(23);
                        camplessLevelOrdinals.push(20);
                        camplessLevelOrdinals.push(17);
                        camplessLevelOrdinals.push(14);
                        camplessLevelOrdinals.push(15);
                        camplessLevelOrdinals.push(12);
                        camplessLevelOrdinals.push(10);
                        camplessLevelOrdinals.push(8);
                        camplessLevelOrdinals.push(5);
                        camplessLevelOrdinals.push(3);
                        break;
                    case 1:
                        camplessLevelOrdinals.push(25);
                        camplessLevelOrdinals.push(23);
                        camplessLevelOrdinals.push(21);
                        camplessLevelOrdinals.push(19);
                        camplessLevelOrdinals.push(17);
                        camplessLevelOrdinals.push(14);
                        camplessLevelOrdinals.push(13);
                        camplessLevelOrdinals.push(11);
                        camplessLevelOrdinals.push(9);
                        camplessLevelOrdinals.push(6);
                        camplessLevelOrdinals.push(3);
                        break;
                    case 2:
                        camplessLevelOrdinals.push(26);
                        camplessLevelOrdinals.push(24);
                        camplessLevelOrdinals.push(22);
                        camplessLevelOrdinals.push(19);
                        camplessLevelOrdinals.push(16);
                        camplessLevelOrdinals.push(15);
                        camplessLevelOrdinals.push(13);
                        camplessLevelOrdinals.push(11);
                        camplessLevelOrdinals.push(9);
                        camplessLevelOrdinals.push(7);
                        camplessLevelOrdinals.push(5);
                        camplessLevelOrdinals.push(3);
                        break;
                    case 3:
                        camplessLevelOrdinals.push(25);
                        camplessLevelOrdinals.push(23);
                        camplessLevelOrdinals.push(21);
                        camplessLevelOrdinals.push(18);
                        camplessLevelOrdinals.push(16);
                        camplessLevelOrdinals.push(14);
                        camplessLevelOrdinals.push(13);
                        camplessLevelOrdinals.push(11);
                        camplessLevelOrdinals.push(8);
                        camplessLevelOrdinals.push(6);
                        camplessLevelOrdinals.push(3);
                        break;
                    case 4:
                        camplessLevelOrdinals.push(23);
                        camplessLevelOrdinals.push(20);
                        camplessLevelOrdinals.push(17);
                        camplessLevelOrdinals.push(15);
                        camplessLevelOrdinals.push(14);
                        camplessLevelOrdinals.push(12);
                        camplessLevelOrdinals.push(10);
                        camplessLevelOrdinals.push(7);
                        camplessLevelOrdinals.push(5);
                        camplessLevelOrdinals.push(3);
                        break;
                }
                
                this.camplessLevelOrdinals[seed] = camplessLevelOrdinals.sort((a, b) => a - b);
            }
			return this.camplessLevelOrdinals[seed];
		},
        
        getHardLevelOrdinals: function (seed) {
            if (!this.hardLevelOrdinals[seed]) {
                var hardLevelOrdinals = [];
                var surfaceLevel = this.getHighestLevel(seed);
                hardLevelOrdinals.push(this.getLevelOrdinal(seed, 14));
                hardLevelOrdinals.push(this.getLevelOrdinal(seed, surfaceLevel));
                switch (seed % 5) {
                    case 0:
                        hardLevelOrdinals.push(10);
                        hardLevelOrdinals.push(23);
                        break;
                    case 1:
                        hardLevelOrdinals.push(9);
                        hardLevelOrdinals.push(23);
                        break;
                    case 2:
                        hardLevelOrdinals.push(11);
                        hardLevelOrdinals.push(24);
                        break;
                    case 3:
                        hardLevelOrdinals.push(11);
                        hardLevelOrdinals.push(23);
                        break;
                    case 4:
                        hardLevelOrdinals.push(10);
                        hardLevelOrdinals.push(23);
                        break;
                }
                this.hardLevelOrdinals[seed] = hardLevelOrdinals.sort();
            }
            return this.hardLevelOrdinals[seed];
        },
        
        canHaveGang: function (levelVO, sectorVO) {
            if (!sectorVO) return false;
            if (sectorVO.isCamp) return false;
            if (sectorVO.zone == WorldConstants.ZONE_ENTRANCE) return false;
            if (sectorVO.zone == WorldConstants.ZONE_PASSAGE_TO_CAMP) return false;
            if (sectorVO.zone == WorldConstants.ZONE_PASSAGE_TO_PASSAGE) return false;
            var minDist = levelVO.level == 13 ? 4 : 2;
            if (this.getQuickDistanceToCamp(levelVO, sectorVO) < 3) return false;
            return true;
        },
		
		isDarkLevel: function (seed, level) {
			return !this.isEarthLevel(seed, level) && !this.isSunLevel(seed, level);
		},
		
		isEarthLevel: function( seed, level ) {
			var lowest = this.getBottomLevel(seed, level);
			return level <= Math.min(lowest + 5, 3);
		},
		
		isSunLevel: function( seed, level ) {
			var highest = this.getHighestLevel(seed, level);
			return level >= highest - 5;
		},
        
        containsBlockingFeature: function (pos, features, allowNonBuilt) {
            for (var i = 0; i < features.length; i++) {
                var feature = features[i];
                if (allowNonBuilt && !feature.isBuilt()) continue;
                if (feature.containsPosition(pos)) {
                    return true;
                }
            }
            return false;
        },
        
    };

    return WorldCreatorHelper;
});
