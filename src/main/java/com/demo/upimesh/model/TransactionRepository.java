package com.demo.upimesh.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findTop20ByOrderByIdDesc();
    List<Transaction> findTop50ByOrderByIdDesc();
    List<Transaction> findBySenderVpaOrReceiverVpaOrderByIdDesc(String senderVpa, String receiverVpa);
    List<Transaction> findByStatusOrderByIdDesc(Transaction.Status status);
    boolean existsByPacketHash(String packetHash);
}
