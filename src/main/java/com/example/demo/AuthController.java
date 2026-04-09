package com.example.demo;

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/auth") // Ou apenas /auth
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    @Autowired
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // Provavelmente tinhas aqui métodos como:
    // @PostMapping("/login")
    // public ResponseEntity<?> login(@RequestBody LoginDTO loginDto) { ... }
}