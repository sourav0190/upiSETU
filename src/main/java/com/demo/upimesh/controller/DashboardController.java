package com.demo.upimesh.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    /**
     * Serves the modern MeshPay Fintech Application at root.
     */
    @GetMapping("/")
    public String home() {
        return "forward:/index.html";
    }

    /**
     * Preserves the classic raw developer test console at /classic.
     */
    @GetMapping("/classic")
    public String classic() {
        return "dashboard";
    }
}
