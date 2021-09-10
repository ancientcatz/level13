define(['ash', 'game/vos/FollowerVO', 'game/constants/FollowerConstants', 'game/constants/ItemConstants'],
function (Ash, FollowerVO, FollowerConstants, ItemConstants) {
	var FollowersComponent = Ash.Class.extend({

		followers: [],

		constructor: function () {
			this.followers = [];
		},
		
		getAll: function () {
			return this.followers;
		},
		
		getParty: function () {
			let followersInParty = [];
			for (let i = 0; i < this.followers.length; i++) {
				if (this.followers[i].inParty) {
					followersInParty.push(this.followers[i]);
				}
			}
			return followersInParty;
		},
		
		getFollowerByID: function (followerID) {
			for (let i = 0; i < this.followers.length; i++) {
				if (this.followers[i].id == followerID) {
					return this.followers[i];
				}
			}
			return null;
		},
		
		addFollower: function (follower, addToParty) {
			this.followers.push(follower);
			follower.inParty = true;
		},
		
		setFollowerInParty: function (follower, inParty) {
			follower.inParty = inParty;
		},
		
		removeFollower: function (follower) {
			var index = this.followers.indexOf(follower);
			if (index < 0) {
				log.w("couldn't find follower to remove: " + follower.id);
				return;
			}
  			this.followers.splice(index, 1);
		},
		
		getCurrentBonus: function (itemBonusType) {
			var isMultiplier = ItemConstants.isMultiplier(itemBonusType);
			var bonus = isMultiplier ? 1 : 0;
			for (let i = 0; i < this.followers.length; i++) {
				var follower = this.followers[i];
				if (follower.inParty) {
					let followerBonus = FollowerConstants.getFollowerItemBonus(follower, itemBonusType);
					if (isMultiplier) {
						if (followerBonus != 0) {
							bonus *= followerBonus;
						}
					} else {
						bonus += followerBonus;
					}
				}
			}
			return bonus;
		},

		getSaveKey: function () {
			return "Followers";
		},

		getCustomSaveObject: function () {
			var copy = {};
			copy.followers = this.followers;
			return copy;
		},

		customLoadFromSave: function (componentValues) {
			this.followers = componentValues.followers;
		}
	});

	return FollowersComponent;
});
