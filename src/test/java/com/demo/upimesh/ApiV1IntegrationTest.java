package com.demo.upimesh;

import com.demo.upimesh.controller.ApiV1Controller;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.service.DemoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ApiV1IntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private DemoService demoService;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void testGetWalletEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/wallet").param("vpa", "alice@demo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vpa").value("alice@demo"))
                .andExpect(jsonPath("$.offlineAllowanceLimitPaise").value(200000L));
    }

    @Test
    void testGetTransactionsEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/transactions"))
                .andExpect(status().isOk());
    }

    @Test
    void testSyncBatchEndpoint() throws Exception {
        MeshPacket packet = demoService.createPacket(
                "alice@demo", "bob@demo", new BigDecimal("25.00"), "1234", 5);

        ApiV1Controller.SyncBatchRequest req = new ApiV1Controller.SyncBatchRequest();
        req.bridgeNodeId = "mock-bridge-test";
        req.packets = List.of(packet);

        mockMvc.perform(post("/api/v1/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPackets").value(1))
                .andExpect(jsonPath("$.settledCount").value(1));
    }

    @Test
    void testSyncStatusEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/sync/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serverTime").isNumber());
    }
}
