package com.streetfootball.game.profile

class ProfileNotFoundException : RuntimeException("No active game profile was found.")

class ProfileAlreadyExistsException : RuntimeException("This session already has a game profile.")
